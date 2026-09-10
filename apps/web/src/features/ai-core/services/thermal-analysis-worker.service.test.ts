import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readiness: vi.fn(),
  claimBatch: vi.fn(),
  process: vi.fn(),
  scheduleRetry: vi.fn(),
  releaseLease: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: {} }));
vi.mock("@/features/ai-core/services/thermal-ai-gateway.service", () => ({ thermalAiGateway: { checkReadiness: mocks.readiness } }));
vi.mock("@/features/ai-core/services/thermal-orchestrator.service", () => ({ thermalOrchestratorService: { processInferenceRequest: mocks.process } }));
vi.mock("@/features/ai-core/repositories/inference-request.repository", () => ({ inferenceRequestRepository: {
  claimBatch: mocks.claimBatch,
  scheduleRetry: mocks.scheduleRetry,
  releaseLease: mocks.releaseLease,
} }));
vi.mock("@/features/sensor-devices/services/device-connectivity.service", () => ({ deviceConnectivityService: { reconcile: vi.fn() } }));

import { thermalAnalysisWorkerService } from "./thermal-analysis-worker.service";

describe("thermalAnalysisWorkerService.run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readiness.mockResolvedValue({ ready: true });
    mocks.claimBatch
      .mockResolvedValueOnce({ lockToken: "lease", inferenceRequestIds: ["request-1", "request-2"] })
      .mockResolvedValue({ lockToken: "lease-2", inferenceRequestIds: [] });
  });

  it("conclui sucesso e agenda falha transitória com o mesmo lease", async () => {
    mocks.process.mockResolvedValueOnce({ outcome: "SUCCEEDED" }).mockResolvedValueOnce({ outcome: "TRANSIENT_FAILURE" });
    const report = await thermalAnalysisWorkerService.run({ maxJobs: 10, concurrency: 2, timeBudgetMs: 5000 });
    expect(report).toMatchObject({ claimedCount: 2, processedCount: 2, succeededCount: 1, retryScheduledCount: 1 });
    expect(mocks.scheduleRetry).toHaveBeenCalledWith("request-2", "lease");
    expect(mocks.releaseLease).toHaveBeenCalledWith("request-1", "lease");
  });

  it("não retira jobs da fila quando a IA está indisponível", async () => {
    mocks.readiness.mockResolvedValue({ ready: false, reason: "NOT_READY" });
    const report = await thermalAnalysisWorkerService.run();
    expect(report.claimedCount).toBe(0);
    expect(report.stoppedReason).toContain("NOT_READY");
    expect(mocks.claimBatch).not.toHaveBeenCalled();
  });
});
