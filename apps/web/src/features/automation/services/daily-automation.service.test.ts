import { beforeEach, describe, expect, it, vi } from "vitest";

const { runScheduledGeneration, runThermalBackfill } = vi.hoisted(() => ({
  runScheduledGeneration: vi.fn(),
  runThermalBackfill: vi.fn(),
}));

vi.mock("@/features/maintenance-plans/services/maintenance-plan.service", () => ({
  maintenancePlanService: { runScheduledGeneration },
}));
vi.mock("@/features/ai-core/services/thermal-backfill.service", () => ({
  thermalBackfillService: { run: runThermalBackfill },
}));

import { runDailyAutomation } from "@/features/automation/services/daily-automation.service";

describe("runDailyAutomation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("executa exatamente uma vez as duas rotinas e consolida o resultado", async () => {
    runScheduledGeneration.mockResolvedValue([{ planId: "p1", workOrderId: "o1", workOrderNumber: "OS-1" }]);
    runThermalBackfill.mockResolvedValue({
      eligibleCount: 10,
      enqueuedCount: 10,
      processedCount: 10,
      succeededCount: 10,
      transientFailureCount: 0,
      failedCount: 0,
      dryRun: false,
    });

    const result = await runDailyAutomation();

    expect(runScheduledGeneration).toHaveBeenCalledTimes(1);
    expect(runThermalBackfill).toHaveBeenCalledTimes(1);
    expect(runThermalBackfill).toHaveBeenCalledWith({ dryRun: false });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.preventive.generatedCount).toBe(1);
    expect(result.thermal.status).toBe("SUCCEEDED");
  });

  it("continua para o processamento térmico quando o scheduler preventivo falha", async () => {
    runScheduledGeneration.mockRejectedValue(new Error("falha preventiva"));
    runThermalBackfill.mockResolvedValue({
      eligibleCount: 0,
      enqueuedCount: 0,
      processedCount: 0,
      succeededCount: 0,
      transientFailureCount: 0,
      failedCount: 0,
      dryRun: false,
    });

    const result = await runDailyAutomation();

    expect(runThermalBackfill).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(result.preventive).toMatchObject({ status: "FAILED", error: "falha preventiva" });
    expect(result.thermal.status).toBe("SUCCEEDED");
  });

  it("registra IA indisponível como bloqueio fail-closed, sem inventar falha global", async () => {
    runScheduledGeneration.mockResolvedValue([]);
    runThermalBackfill.mockResolvedValue({
      eligibleCount: 25,
      enqueuedCount: 0,
      processedCount: 0,
      succeededCount: 0,
      transientFailureCount: 0,
      failedCount: 0,
      dryRun: false,
      stoppedReason: "Núcleo de IA indisponível.",
    });

    const result = await runDailyAutomation();

    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(result.thermal).toMatchObject({ status: "BLOCKED", error: "Núcleo de IA indisponível." });
  });
});
