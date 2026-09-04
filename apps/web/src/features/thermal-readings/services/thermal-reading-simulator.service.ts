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

export const thermalReadingSimulatorService = {
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
