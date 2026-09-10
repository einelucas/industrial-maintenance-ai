import { beforeEach, describe, expect, it, vi } from "vitest";

const { runScheduledGeneration, runThermalWorker, purgeTelemetryAudits } = vi.hoisted(() => ({
  runScheduledGeneration: vi.fn(),
  runThermalWorker: vi.fn(),
  purgeTelemetryAudits: vi.fn(),
}));

vi.mock("@/features/maintenance-plans/services/maintenance-plan.service", () => ({
  maintenancePlanService: { runScheduledGeneration },
}));
vi.mock("@/features/ai-core/services/thermal-analysis-worker.service", () => ({
  thermalAnalysisWorkerService: { reconcileAndRun: runThermalWorker },
}));
vi.mock("@/features/telemetry/services/telemetry-retention.service", () => ({
  telemetryRetentionService: { purgeExpiredRequestAudits: purgeTelemetryAudits },
}));

import { runDailyAutomation } from "@/features/automation/services/daily-automation.service";

describe("runDailyAutomation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    purgeTelemetryAudits.mockResolvedValue({ deletedCount: 0, cutoff: new Date("2026-06-01T00:00:00Z") });
  });

  it("executa exatamente uma vez as duas rotinas e consolida o resultado", async () => {
    runScheduledGeneration.mockResolvedValue([{ planId: "p1", workOrderId: "o1", workOrderNumber: "OS-1" }]);
    runThermalWorker.mockResolvedValue({
      releasedLeases: 0,
      recoveredFailures: 0,
      orphanedEnqueued: 0,
      connectivity: { online: 55, offline: 0, degraded: 0, unchanged: 0 },
      worker: { claimedCount: 10, processedCount: 10, succeededCount: 10, alreadyProcessedCount: 0, retryScheduledCount: 0, failedCount: 0, durationMs: 100 },
    });

    const result = await runDailyAutomation();

    expect(runScheduledGeneration).toHaveBeenCalledTimes(1);
    expect(runThermalWorker).toHaveBeenCalledTimes(1);
    expect(purgeTelemetryAudits).toHaveBeenCalledTimes(1);
    expect(runThermalWorker).toHaveBeenCalledWith({ maxJobs: 100, concurrency: 8, timeBudgetMs: 50_000 });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.preventive.generatedCount).toBe(1);
    expect(result.thermal.status).toBe("SUCCEEDED");
  });

  it("continua para o processamento térmico quando o scheduler preventivo falha", async () => {
    runScheduledGeneration.mockRejectedValue(new Error("falha preventiva"));
    runThermalWorker.mockResolvedValue({
      releasedLeases: 0,
      recoveredFailures: 0,
      orphanedEnqueued: 0,
      connectivity: { online: 0, offline: 0, degraded: 0, unchanged: 0 },
      worker: { claimedCount: 0, processedCount: 0, succeededCount: 0, alreadyProcessedCount: 0, retryScheduledCount: 0, failedCount: 0, durationMs: 1 },
    });

    const result = await runDailyAutomation();

    expect(runThermalWorker).toHaveBeenCalledTimes(1);
    expect(purgeTelemetryAudits).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(result.preventive).toMatchObject({ status: "FAILED", error: "falha preventiva" });
    expect(result.thermal.status).toBe("SUCCEEDED");
  });

  it("registra IA indisponível como bloqueio fail-closed, sem inventar falha global", async () => {
    runScheduledGeneration.mockResolvedValue([]);
    runThermalWorker.mockResolvedValue({
      releasedLeases: 0,
      recoveredFailures: 0,
      orphanedEnqueued: 0,
      connectivity: { online: 0, offline: 55, degraded: 0, unchanged: 0 },
      worker: { claimedCount: 0, processedCount: 0, succeededCount: 0, alreadyProcessedCount: 0, retryScheduledCount: 0, failedCount: 0, durationMs: 1, stoppedReason: "Núcleo de IA indisponível." },
    });

    const result = await runDailyAutomation();

    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(result.thermal).toMatchObject({ status: "BLOCKED", error: "Núcleo de IA indisponível." });
  });
});
