import { prisma } from "@/lib/db/client";
import { inferenceRequestRepository } from "@/features/ai-core/repositories/inference-request.repository";
import { thermalOrchestratorService } from "@/features/ai-core/services/thermal-orchestrator.service";
import { thermalAiGateway } from "@/features/ai-core/services/thermal-ai-gateway.service";
import { buildInferenceRequestId } from "@/features/ai-core/services/inference-request-id";
import { THERMAL_FEATURE_VERSION } from "@/features/ai-core/temporal-features/calculate-temporal-features";
import { deviceConnectivityService } from "@/features/sensor-devices/services/device-connectivity.service";

export interface ThermalWorkerOptions {
  maxJobs?: number;
  concurrency?: number;
  timeBudgetMs?: number;
}

export interface ThermalWorkerReport {
  claimedCount: number;
  processedCount: number;
  succeededCount: number;
  alreadyProcessedCount: number;
  retryScheduledCount: number;
  failedCount: number;
  durationMs: number;
  stoppedReason?: string;
}

export interface ThermalBacklogStatus {
  orphanedCount: number;
  queuedCount: number;
  leasedCount: number;
  failedCount: number;
  remainingCount: number;
}

function bounded(value: number | undefined, fallback: number, min: number, max: number): number {
  return Number.isInteger(value) && value! >= min && value! <= max ? value! : fallback;
}

async function enqueueOrphanReadings(limit: number): Promise<number> {
  const readings = await prisma.thermalReading.findMany({
    where: { analysisStatus: "PENDING_AI", inferenceRequests: { none: {} } },
    orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { id: true, thermalPointId: true },
  });
  if (!readings.length) return 0;
  const result = await prisma.inferenceRequest.createMany({
    data: readings.map((reading) => ({
      inferenceRequestId: buildInferenceRequestId(reading.id, THERMAL_FEATURE_VERSION),
      thermalReadingId: reading.id,
      thermalPointId: reading.thermalPointId,
      featureVersion: THERMAL_FEATURE_VERSION,
      status: "PENDING",
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export const thermalAnalysisWorkerService = {
  async backlogStatus(now = new Date()): Promise<ThermalBacklogStatus> {
    const [orphanedCount, queuedCount, leasedCount, failedCount] = await Promise.all([
      prisma.thermalReading.count({ where: { analysisStatus: "PENDING_AI", inferenceRequests: { none: {} } } }),
      prisma.inferenceRequest.count({ where: { status: "PENDING" } }),
      prisma.inferenceRequest.count({ where: { status: "PENDING", leaseExpiresAt: { gt: now } } }),
      prisma.inferenceRequest.count({ where: { status: "FAILED" } }),
    ]);
    return { orphanedCount, queuedCount, leasedCount, failedCount, remainingCount: orphanedCount + queuedCount };
  },

  async run(options: ThermalWorkerOptions = {}): Promise<ThermalWorkerReport> {
    const startedAt = Date.now();
    const maxJobs = bounded(options.maxJobs, 55, 1, 500);
    const concurrency = bounded(options.concurrency, 8, 1, 20);
    const timeBudgetMs = bounded(options.timeBudgetMs, 50_000, 5_000, 55_000);
    const report: ThermalWorkerReport = {
      claimedCount: 0,
      processedCount: 0,
      succeededCount: 0,
      alreadyProcessedCount: 0,
      retryScheduledCount: 0,
      failedCount: 0,
      durationMs: 0,
    };

    const readiness = await thermalAiGateway.checkReadiness();
    if (!readiness.ready) {
      report.durationMs = Date.now() - startedAt;
      report.stoppedReason = `Núcleo de IA indisponível: ${readiness.reason ?? "motivo não informado"}.`;
      return report;
    }

    while (report.claimedCount < maxJobs && Date.now() - startedAt < timeBudgetMs) {
      const remaining = maxJobs - report.claimedCount;
      const claimed = await inferenceRequestRepository.claimBatch(Math.min(concurrency, remaining));
      if (!claimed.inferenceRequestIds.length) break;
      report.claimedCount += claimed.inferenceRequestIds.length;

      await Promise.all(claimed.inferenceRequestIds.map(async (inferenceRequestId) => {
        try {
          const result = await thermalOrchestratorService.processInferenceRequest(inferenceRequestId);
          report.processedCount++;
          if (result.outcome === "SUCCEEDED") report.succeededCount++;
          else if (result.outcome === "ALREADY_PROCESSED") report.alreadyProcessedCount++;
          else if (result.outcome === "TRANSIENT_FAILURE") {
            report.retryScheduledCount++;
            await inferenceRequestRepository.scheduleRetry(inferenceRequestId, claimed.lockToken);
          } else report.failedCount++;

          if (result.outcome !== "TRANSIENT_FAILURE") {
            await inferenceRequestRepository.releaseLease(inferenceRequestId, claimed.lockToken);
          }
        } catch {
          report.processedCount++;
          report.retryScheduledCount++;
          await inferenceRequestRepository.scheduleRetry(inferenceRequestId, claimed.lockToken);
        }
      }));
    }

    report.durationMs = Date.now() - startedAt;
    if (report.claimedCount < maxJobs && report.durationMs >= timeBudgetMs) {
      report.stoppedReason = "Orçamento de tempo do worker atingido; itens restantes permanecem duráveis na fila.";
    }
    return report;
  },

  async reconcileAndRun(options: ThermalWorkerOptions = {}) {
    const [releasedLeases, recoveredFailures, orphanedEnqueued, connectivity] = await Promise.all([
      inferenceRequestRepository.releaseExpiredLeases(),
      inferenceRequestRepository.recoverTransientFailures(),
      enqueueOrphanReadings(500),
      deviceConnectivityService.reconcile(),
    ]);
    const worker = await this.run(options);
    const backlog = await this.backlogStatus();
    return { releasedLeases: releasedLeases.count, recoveredFailures, orphanedEnqueued, connectivity, worker, backlog };
  },
};
