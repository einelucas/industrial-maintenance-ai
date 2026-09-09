import {
  generateScenarioReadings,
  SIMULATOR_SCENARIOS,
  type SimulatorScenario,
} from "@/lib/thermal-simulation/reading-scenarios";
import { thermalReadingMeasurementSchema } from "@/features/thermal-readings/schemas/thermal-reading-measurement.schema";
import {
  thermalReadingService,
  type BatchIngestRejection,
  type PreparedReadingRow,
} from "@/features/thermal-readings/services/thermal-reading.service";
import { thermalPointRepository } from "@/features/thermal-points/repositories/thermal-point.repository";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/db/client";
import { buildPlantDemoCycle } from "@/lib/thermal-simulation/plant-demo-cycle";
import { thermalBackfillService, type BackfillReport } from "@/features/ai-core/services/thermal-backfill.service";

export { SIMULATOR_SCENARIOS };
export type { SimulatorScenario };

// Simulador de leituras (GPMS 2026 / Etapa 4) — grava pelo MESMO
// `thermalReadingService.ingestBatchByCode` usado pela importação CSV.
// Nunca devolve `Prediction`, risco, causa ou alerta: o retorno é só um
// relatório de quantas leituras BRUTAS foram aceitas/rejeitadas. O `now`
// (instante de referência da série) é sempre recebido como parâmetro —
// só a action que chama este service (fronteira de I/O) pode obtê-lo de
// `new Date()`; este arquivo nunca lê o relógio diretamente.
export interface RunSimulatorInput {
  thermalPointId: string;
  scenario: SimulatorScenario;
  seed: number;
  sampleCount: number;
  intervalMinutes: number;
  referenceTemperatureC?: number;
}

export interface RunSimulatorResult {
  scenario: SimulatorScenario;
  thermalPointCode: string;
  totalGenerated: number;
  acceptedCount: number;
  rejectedCount: number;
  rejected: BatchIngestRejection[];
}

export interface RunPlantDemoResult {
  pointCount: number;
  expectedAnomalousPointCount: number;
  officialCriticalPointCode: string;
  samplesPerPoint: number;
  acceptedCount: number;
  detectedRiskPointCount: number;
  analyzedAt: string;
  analysis: BackfillReport;
}

export const thermalReadingSimulatorService = {
  async runPlantDemo(now: Date): Promise<RunPlantDemoResult> {
    // Arredondar ao minuto torna um duplo clique idempotente/detectável.
    const endAt = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    const cycle = buildPlantDemoCycle(endAt);
    const pointCodes = [...new Set(cycle.rows.map((row) => row.thermalPointCode))];
    const existingCurrent = await prisma.thermalReading.count({
      where: { measuredAt: endAt, source: "SIMULATOR", thermalPoint: { code: { in: pointCodes } } },
    });
    if (existingCurrent > 0) {
      throw new ValidationError("O cenário completo já foi executado neste minuto. Aguarde um minuto antes de repetir.");
    }

    const result = await thermalReadingService.ingestBatchByCode(cycle.rows, "SIMULATOR");
    if (result.rejectedCount > 0 || result.acceptedCount !== cycle.rows.length) {
      throw new ValidationError(`A carga do cenário ficou incompleta: ${result.acceptedCount} aceitas e ${result.rejectedCount} rejeitadas.`);
    }

    const currentReadings = await prisma.thermalReading.findMany({
      where: { measuredAt: endAt, source: "SIMULATOR", thermalPoint: { code: { in: pointCodes } } },
      select: { id: true },
    });
    if (currentReadings.length !== cycle.pointCount) {
      throw new ValidationError(`Esperadas ${cycle.pointCount} leituras atuais, mas foram encontradas ${currentReadings.length}.`);
    }

    const analysis = await thermalBackfillService.runSpecificReadings(currentReadings.map((reading) => reading.id));
    const detectedRiskPointCount = await prisma.prediction.count({
      where: {
        thermalReadingId: { in: currentReadings.map((reading) => reading.id) },
        riskLevel: { in: ["MODERATE", "HIGH", "CRITICAL"] },
      },
    });
    return {
      pointCount: cycle.pointCount,
      expectedAnomalousPointCount: cycle.expectedAnomalousPointCount,
      officialCriticalPointCode: cycle.officialCriticalPointCode,
      samplesPerPoint: cycle.rows.length / cycle.pointCount,
      acceptedCount: result.acceptedCount,
      detectedRiskPointCount,
      analyzedAt: endAt.toISOString(),
      analysis,
    };
  },

  async run(input: RunSimulatorInput, now: Date): Promise<RunSimulatorResult> {
    const point = await thermalPointRepository.findById(input.thermalPointId);
    if (!point) throw new NotFoundError("Ponto termográfico", input.thermalPointId);
    if (!point.active) {
      throw new ValidationError("Não é possível simular leituras para um ponto inativo.", {
        thermalPointId: ["Ponto termográfico inativo."],
      });
    }
    if (!Number.isFinite(input.sampleCount) || input.sampleCount < 1 || input.sampleCount > 500) {
      throw new ValidationError("Quantidade de amostras deve estar entre 1 e 500.", {
        sampleCount: ["Fora do intervalo permitido."],
      });
    }
    if (!Number.isFinite(input.intervalMinutes) || input.intervalMinutes < 1) {
      throw new ValidationError("Intervalo entre amostras deve ser de pelo menos 1 minuto.", {
        intervalMinutes: ["Inválido."],
      });
    }

    const rawRows = generateScenarioReadings({
      thermalPointCode: point.code,
      scenario: input.scenario,
      seed: input.seed,
      sampleCount: input.sampleCount,
      intervalMinutes: input.intervalMinutes,
      endAt: now,
      referenceTemperatureC: input.referenceTemperatureC,
    });

    // Mesmo sendo gerada internamente, toda linha passa pelo MESMO schema de
    // validação do registro manual e da importação CSV — não existe um
    // caminho "de confiança" que pule a validação. É exatamente isso que o
    // cenário INVALID_SENSOR foi desenhado para provar: sai daqui, mas não
    // sobrevive à validação comum.
    const prepared: PreparedReadingRow[] = [];
    const rejected: BatchIngestRejection[] = [];
    rawRows.forEach((row, index) => {
      const parsed = thermalReadingMeasurementSchema.safeParse(row);
      if (!parsed.success) {
        rejected.push({
          rowNumber: index + 1,
          thermalPointCode: row.thermalPointCode,
          reason: parsed.error.issues[0]?.message ?? "Amostra simulada inválida.",
        });
        return;
      }
      prepared.push({ thermalPointCode: row.thermalPointCode, ...parsed.data });
    });

    const batchResult = await thermalReadingService.ingestBatchByCode(prepared, "SIMULATOR");

    return {
      scenario: input.scenario,
      thermalPointCode: point.code,
      totalGenerated: rawRows.length,
      acceptedCount: batchResult.acceptedCount,
      rejectedCount: batchResult.rejectedCount + rejected.length,
      rejected: [...rejected, ...batchResult.rejected],
    };
  },
};
