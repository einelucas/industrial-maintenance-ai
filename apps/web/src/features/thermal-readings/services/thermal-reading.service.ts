import type { MonitoringMode, Prisma, ThermalReading } from "@prisma/client";
import { thermalReadingRepository, type ThermalReadingFilters } from "@/features/thermal-readings/repositories/thermal-reading.repository";
import { thermalPointRepository } from "@/features/thermal-points/repositories/thermal-point.repository";
import { manualThermalReadingSchema } from "@/features/thermal-readings/schemas/manual-thermal-reading.schema";
import { calculateDeltaT, calculateRiseAboveAmbient } from "@/features/thermal-readings/services/thermal-reading-calculations";
import { NotFoundError, ValidationError } from "@/lib/errors";

// Service de ingestão de leituras termográficas (GPMS 2026 / Etapa 4) — o
// ÚNICO caminho que grava em `thermal_readings`. Registro manual, importação
// CSV e simulador convergem todos para as duas funções abaixo
// (`ingestManual` / `ingestBatchByCode`); a futura API de sensores
// autenticados (Etapa 9) deverá reutilizar `ingestBatchByCode` (ou uma
// variante mínima dela) em vez de escrever direto no repository.
//
// Nenhuma das duas funções aceita, deriva ou persiste risco, severidade,
// causa, diagnóstico ou qualquer campo de `Prediction`. `analysisStatus`
// nasce sempre no valor padrão do schema Prisma (`PENDING_AI`) — não é
// setado explicitamente aqui de propósito, para que não exista, neste
// arquivo, nenhuma linha de código capaz de gravar outro valor.

export interface ThermalReadingDto {
  id: string;
  thermalPointId: string;
  measuredAt: Date;
  receivedAt: Date;
  temperatureMaxC: number;
  temperatureAverageC: number | null;
  ambientTemperatureC: number | null;
  referenceTemperatureC: number | null;
  deltaTC: number | null;
  /** Calculado em memória a partir de temperatureMaxC/ambientTemperatureC — não existe coluna própria. */
  riseAboveAmbientC: number | null;
  currentA: number | null;
  loadPercent: number | null;
  emissivity: number | null;
  signalQuality: number | null;
  source: MonitoringMode;
  analysisStatus: string;
}

function toDto(row: ThermalReading): ThermalReadingDto {
  return {
    id: row.id,
    thermalPointId: row.thermalPointId,
    measuredAt: row.measuredAt,
    receivedAt: row.receivedAt,
    temperatureMaxC: row.temperatureMaxC,
    temperatureAverageC: row.temperatureAverageC,
    ambientTemperatureC: row.ambientTemperatureC,
    referenceTemperatureC: row.referenceTemperatureC,
    deltaTC: row.deltaTC,
    riseAboveAmbientC: calculateRiseAboveAmbient(row.temperatureMaxC, row.ambientTemperatureC),
    currentA: row.currentA,
    loadPercent: row.loadPercent,
    emissivity: row.emissivity,
    signalQuality: row.signalQuality,
    source: row.source,
    analysisStatus: row.analysisStatus,
  };
}

/** Formato comum de uma linha já validada, usado tanto pela importação CSV quanto pelo simulador. */
export interface PreparedReadingRow {
  /** Número da linha no arquivo de origem (1-based), só para relatório de importação. Ausente no simulador. */
  rowNumber?: number;
  thermalPointCode: string;
  measuredAt: Date;
  temperatureMaxC: number;
  temperatureAverageC?: number;
  ambientTemperatureC?: number;
  referenceTemperatureC?: number;
  currentA?: number;
  loadPercent?: number;
  emissivity?: number;
  signalQuality?: number;
}

export interface BatchIngestRejection {
  rowNumber?: number;
  thermalPointCode: string;
  reason: string;
}

export interface BatchIngestResult {
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  rejected: BatchIngestRejection[];
}

export const thermalReadingService = {
  /** Registro manual — um único ponto, sempre identificado por id (select real da UI). */
  async ingestManual(rawInput: unknown): Promise<ThermalReadingDto> {
    const parsed = manualThermalReadingSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError("Dados da leitura termográfica inválidos.", parsed.error.flatten().fieldErrors);
    }

    const point = await thermalPointRepository.findById(parsed.data.thermalPointId);
    if (!point) throw new NotFoundError("Ponto termográfico", parsed.data.thermalPointId);
    if (!point.active) {
      throw new ValidationError("Não é possível registrar leitura para um ponto inativo.", {
        thermalPointId: ["Ponto termográfico inativo."],
      });
    }

    const deltaTC = calculateDeltaT(parsed.data.temperatureMaxC, parsed.data.referenceTemperatureC);

    const created = await thermalReadingRepository.create({
      thermalPointId: point.id,
      measuredAt: parsed.data.measuredAt,
      temperatureMaxC: parsed.data.temperatureMaxC,
      temperatureAverageC: parsed.data.temperatureAverageC,
      ambientTemperatureC: parsed.data.ambientTemperatureC,
      referenceTemperatureC: parsed.data.referenceTemperatureC,
      deltaTC,
      currentA: parsed.data.currentA,
      loadPercent: parsed.data.loadPercent,
      emissivity: parsed.data.emissivity,
      signalQuality: parsed.data.signalQuality,
      source: "MANUAL",
    });

    return toDto(created);
  },

  /**
   * Núcleo comum de ingestão em lote — usado pela importação CSV e pelo
   * simulador. Resolve todos os pontos por código em UMA consulta, persiste
   * em chunks e devolve um relatório com aceitos/rejeitados por linha; nunca
   * lança exceção por causa de linhas individuais inválidas (só falha
   * inteiro em erro de infraestrutura), preservando "lote válido mesmo com
   * erros parciais".
   */
  async ingestBatchByCode(rows: PreparedReadingRow[], source: MonitoringMode): Promise<BatchIngestResult> {
    if (rows.length === 0) {
      return { totalRows: 0, acceptedCount: 0, rejectedCount: 0, rejected: [] };
    }

    const codes = [...new Set(rows.map((r) => r.thermalPointCode))];
    const points = await thermalPointRepository.findManyByCodes(codes);
    const pointByCode = new Map(points.map((p) => [p.code, p]));

    const toInsert: Prisma.ThermalReadingUncheckedCreateInput[] = [];
    const rejected: BatchIngestRejection[] = [];

    for (const row of rows) {
      const point = pointByCode.get(row.thermalPointCode);
      if (!point) {
        rejected.push({
          rowNumber: row.rowNumber,
          thermalPointCode: row.thermalPointCode,
          reason: `Ponto termográfico "${row.thermalPointCode}" não encontrado.`,
        });
        continue;
      }
      if (!point.active) {
        rejected.push({
          rowNumber: row.rowNumber,
          thermalPointCode: row.thermalPointCode,
          reason: `Ponto termográfico "${row.thermalPointCode}" está inativo.`,
        });
        continue;
      }

      toInsert.push({
        thermalPointId: point.id,
        measuredAt: row.measuredAt,
        temperatureMaxC: row.temperatureMaxC,
        temperatureAverageC: row.temperatureAverageC,
        ambientTemperatureC: row.ambientTemperatureC,
        referenceTemperatureC: row.referenceTemperatureC,
        deltaTC: calculateDeltaT(row.temperatureMaxC, row.referenceTemperatureC),
        currentA: row.currentA,
        loadPercent: row.loadPercent,
        emissivity: row.emissivity,
        signalQuality: row.signalQuality,
        source,
      });
    }

    const acceptedCount = await thermalReadingRepository.createManyChunked(toInsert);

    return { totalRows: rows.length, acceptedCount, rejectedCount: rejected.length, rejected };
  },

  async listFiltered(filters: ThermalReadingFilters) {
    const { items, total } = await thermalReadingRepository.findFiltered(filters);
    return { items: items.map((row) => ({ ...toDto(row), thermalPoint: row.thermalPoint })), total };
  },

  async listRecentForPoint(thermalPointId: string, take = 50) {
    const rows = await thermalReadingRepository.findRecentForPoint(thermalPointId, take);
    return rows.map(toDto);
  },
};
