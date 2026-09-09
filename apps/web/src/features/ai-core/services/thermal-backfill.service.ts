import { prisma } from "@/lib/db/client";
import { thermalAiGateway } from "@/features/ai-core/services/thermal-ai-gateway.service";
import { thermalOrchestratorService } from "@/features/ai-core/services/thermal-orchestrator.service";
import { inferenceRequestRepository } from "@/features/ai-core/repositories/inference-request.repository";
import { buildInferenceRequestId } from "@/features/ai-core/services/inference-request-id";
import { THERMAL_FEATURE_VERSION } from "@/features/ai-core/temporal-features/calculate-temporal-features";

// Backfill de leituras PENDING_AI (GPMS 2026 / Etapa 5) — prioriza as
// leituras mais recentes para atualizar primeiro o risco atual dos pontos,
// depois drena o histórico em lotes pequenos. Nunca faz chamadas simultâneas,
// interrompe de imediato se a readiness da IA cair no meio da execução, e é
// seguro de retomar (leituras já com `InferenceRequest` — de qualquer
// resultado — nunca são reenfileiradas por esta rotina).
//
// Nada aqui é executado automaticamente. Na Etapa 8 o modelo térmico passou
// a existir, mas qualquer escrita no banco continua exigindo `--run` e
// readiness válida; dry-run permanece o padrão.

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAX_BATCHES = 4;

export interface BackfillOptions {
  batchSize?: number;
  maxBatches?: number;
  dryRun?: boolean;
}

export interface BackfillReport {
  eligibleCount: number;
  enqueuedCount: number;
  processedCount: number;
  succeededCount: number;
  transientFailureCount: number;
  failedCount: number;
  dryRun: boolean;
  stoppedReason?: string;
}

export const thermalBackfillService = {
  /** Leituras PENDING_AI que nunca entraram na fila de inferência, em nenhuma versão de features. */
  countEligible(): Promise<number> {
    return prisma.thermalReading.count({
      where: { analysisStatus: "PENDING_AI", inferenceRequests: { none: {} } },
    });
  },

  async run(options: BackfillOptions = {}): Promise<BackfillReport> {
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const maxBatches = options.maxBatches ?? DEFAULT_MAX_BATCHES;
    const dryRun = options.dryRun ?? false;

    const eligibleCount = await this.countEligible();

    if (dryRun) {
      return { eligibleCount, enqueuedCount: 0, processedCount: 0, succeededCount: 0, transientFailureCount: 0, failedCount: 0, dryRun: true };
    }

    const readiness = await thermalAiGateway.checkReadiness();
    if (!readiness.ready) {
      return {
        eligibleCount,
        enqueuedCount: 0,
        processedCount: 0,
        succeededCount: 0,
        transientFailureCount: 0,
        failedCount: 0,
        dryRun: false,
        stoppedReason: `Núcleo de IA térmica indisponível — nada foi processado: ${readiness.reason ?? "motivo não informado"}.`,
      };
    }

    let enqueuedCount = 0;
    let processedCount = 0;
    let succeededCount = 0;
    let transientFailureCount = 0;
    let failedCount = 0;

    for (let batch = 0; batch < maxBatches; batch++) {
      // Primeiro drena requisições PENDING já enfileiradas, também em ordem
      // de leitura mais recente, antes de enfileirar novas solicitações.
      const existingPending = await inferenceRequestRepository.findPendingBatch(batchSize);

      let inferenceRequestIds: string[];
      if (existingPending.length > 0) {
        inferenceRequestIds = existingPending.map((r) => r.inferenceRequestId);
      } else {
        const newReadings = await prisma.thermalReading.findMany({
          where: { analysisStatus: "PENDING_AI", inferenceRequests: { none: {} } },
          orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
          take: batchSize,
        });
        if (newReadings.length === 0) break;

        inferenceRequestIds = [];
        for (const reading of newReadings) {
          const inferenceRequestId = buildInferenceRequestId(reading.id, THERMAL_FEATURE_VERSION);
          await inferenceRequestRepository.upsertPending({
            inferenceRequestId,
            thermalReadingId: reading.id,
            thermalPointId: reading.thermalPointId,
            featureVersion: THERMAL_FEATURE_VERSION,
          });
          enqueuedCount++;
          inferenceRequestIds.push(inferenceRequestId);
        }
      }

      for (const id of inferenceRequestIds) {
        const result = await thermalOrchestratorService.processInferenceRequest(id);
        processedCount++;
        if (result.outcome === "SUCCEEDED") succeededCount++;
        else if (result.outcome === "TRANSIENT_FAILURE") transientFailureCount++;
        else if (result.outcome === "FAILED") failedCount++;
      }

      // Readiness pode cair no meio de uma execução longa — verificamos de
      // novo entre lotes e interrompemos imediatamente.
      if (batch < maxBatches - 1) {
        const stillReady = await thermalAiGateway.checkReadiness();
        if (!stillReady.ready) {
          return {
            eligibleCount,
            enqueuedCount,
            processedCount,
            succeededCount,
            transientFailureCount,
            failedCount,
            dryRun: false,
            stoppedReason: `Núcleo de IA térmica ficou indisponível durante a execução — interrompido: ${stillReady.reason ?? "motivo não informado"}.`,
          };
        }
      }
    }

    return { eligibleCount, enqueuedCount, processedCount, succeededCount, transientFailureCount, failedCount, dryRun: false };
  },

  /**
   * Analisa somente a leitura mais recente de cada ponto ativo. Este caminho
   * atende a sincronizacao extraordinaria da interface sem disputar a ordem
   * da fila historica, que continua sendo drenada pelo cron diario.
   */
  async runCurrentReadings(): Promise<BackfillReport> {
    const points = await prisma.thermalPoint.findMany({
      where: { active: true },
      select: {
        readings: {
          orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { id: true },
        },
      },
    });
    const latestReadingIds = points.flatMap((point) => point.readings.map((reading) => reading.id));
    return this.runSpecificReadings(latestReadingIds);
  },

  /** Processa um conjunto explícito de leituras, usado pelo ciclo demonstrativo da planta. */
  async runSpecificReadings(readingIds: string[]): Promise<BackfillReport> {
    const uniqueIds = [...new Set(readingIds)];
    if (uniqueIds.length > 100) throw new Error("O processamento direcionado aceita no máximo 100 leituras.");

    const readings = await prisma.thermalReading.findMany({
      where: { id: { in: uniqueIds }, analysisStatus: "PENDING_AI" },
      orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
      select: { id: true, thermalPointId: true },
    });
    const eligibleCount = readings.length;
    const readiness = await thermalAiGateway.checkReadiness();
    if (!readiness.ready) {
      return {
        eligibleCount, enqueuedCount: 0, processedCount: 0, succeededCount: 0,
        transientFailureCount: 0, failedCount: 0, dryRun: false,
        stoppedReason: `Núcleo de IA térmica indisponível — nada foi processado: ${readiness.reason ?? "motivo não informado"}.`,
      };
    }

    const requestIds: string[] = [];
    for (const reading of readings) {
      const inferenceRequestId = buildInferenceRequestId(reading.id, THERMAL_FEATURE_VERSION);
      await inferenceRequestRepository.upsertPending({
        inferenceRequestId,
        thermalReadingId: reading.id,
        thermalPointId: reading.thermalPointId,
        featureVersion: THERMAL_FEATURE_VERSION,
      });
      requestIds.push(inferenceRequestId);
    }

    let succeededCount = 0;
    let transientFailureCount = 0;
    let failedCount = 0;
    for (const id of requestIds) {
      const result = await thermalOrchestratorService.processInferenceRequest(id);
      if (result.outcome === "SUCCEEDED") succeededCount++;
      else if (result.outcome === "TRANSIENT_FAILURE") transientFailureCount++;
      else if (result.outcome === "FAILED") failedCount++;
    }

    return {
      eligibleCount,
      enqueuedCount: requestIds.length,
      processedCount: requestIds.length,
      succeededCount,
      transientFailureCount,
      failedCount,
      dryRun: false,
    };
  },
};
