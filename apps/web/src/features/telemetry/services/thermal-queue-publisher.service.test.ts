import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@vercel/queue", () => ({ send: mocks.send }));

import { thermalQueuePublisherService } from "./thermal-queue-publisher.service";

const ingestion = {
  schemaVersion: "thermal-telemetry-v1" as const,
  receivedCount: 1,
  acceptedCount: 1,
  duplicateCount: 0,
  rejectedCount: 0,
  queuedCount: 1,
  results: [{ index: 0, sequence: 10, status: "ACCEPTED" as const, thermalReadingId: "reading-1" }],
};

describe("thermalQueuePublisherService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERCEL_ENV;
  });
  afterEach(() => delete process.env.VERCEL_ENV);

  it("usa fallback local sem tentar publicar fora da Vercel", async () => {
    await expect(thermalQueuePublisherService.publish("device", ingestion)).resolves.toEqual({ state: "LOCAL_FALLBACK" });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("publica um único gatilho idempotente para o lote persistido", async () => {
    process.env.VERCEL_ENV = "production";
    mocks.send.mockResolvedValue({ messageId: "msg-1" });
    await expect(thermalQueuePublisherService.publish("device", ingestion)).resolves.toEqual({ state: "QUEUE_PUBLISHED", messageId: "msg-1" });
    expect(mocks.send).toHaveBeenCalledWith("thermal-analysis", { schemaVersion: 1, requestedJobs: 1 }, expect.objectContaining({ idempotencyKey: expect.stringMatching(/^thermal-/), retentionSeconds: 86_400 }));
  });

  it("não publica quando o lote não criou trabalho novo", async () => {
    process.env.VERCEL_ENV = "production";
    await expect(thermalQueuePublisherService.publish("device", { ...ingestion, acceptedCount: 0, queuedCount: 0 })).resolves.toEqual({ state: "NOT_REQUIRED" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
