import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateTelemetryDevice: vi.fn(),
  recordTelemetryRequest: vi.fn(),
  telemetryIdentifierHash: vi.fn(() => "identifier-hash"),
  ingest: vi.fn(),
  runWorker: vi.fn(),
}));

vi.mock("@/features/telemetry/services/device-auth.service", async () => {
  class TelemetryAuthError extends Error {
    constructor(message: string, readonly status: number, readonly code: string) { super(message); }
  }
  return {
    authenticateTelemetryDevice: mocks.authenticateTelemetryDevice,
    recordTelemetryRequest: mocks.recordTelemetryRequest,
    telemetryIdentifierHash: mocks.telemetryIdentifierHash,
    TelemetryAuthError,
  };
});
vi.mock("@/features/telemetry/services/thermal-telemetry.service", () => ({ thermalTelemetryService: { ingest: mocks.ingest } }));
vi.mock("@/features/ai-core/services/thermal-analysis-worker.service", () => ({ thermalAnalysisWorkerService: { run: mocks.runWorker } }));

import { POST } from "./route";

const reading = {
  sequence: 1,
  thermalPointCode: "TP-039",
  measuredAt: "2026-09-09T16:00:00.000Z",
  temperatureMaxC: 75.6,
  referenceTemperatureC: 40,
};

describe("POST /api/v1/telemetry/thermal-readings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateTelemetryDevice.mockResolvedValue({ id: "device", identifierHash: "identifier-hash", thermalPoint: { code: "TP-039" } });
    mocks.ingest.mockResolvedValue({ schemaVersion: "thermal-telemetry-v1", receivedCount: 1, acceptedCount: 1, duplicateCount: 0, rejectedCount: 0, queuedCount: 1, results: [{ index: 0, sequence: 1, status: "ACCEPTED" }] });
    mocks.runWorker.mockResolvedValue({ processedCount: 1, retryScheduledCount: 0 });
  });

  it("persiste/enfileira antes de acionar o worker e não retorna classificação", async () => {
    const response = await POST(new Request("http://localhost/api/v1/telemetry/thermal-readings", {
      method: "POST",
      headers: { authorization: "Bearer secret", "x-device-id": "device", "content-type": "application/json" },
      body: JSON.stringify({ schemaVersion: "thermal-telemetry-v1", readings: [reading] }),
    }));
    expect(response.status).toBe(202);
    expect(mocks.ingest.mock.invocationCallOrder[0]).toBeLessThan(mocks.runWorker.mock.invocationCallOrder[0]!);
    const body = await response.json();
    expect(body.acceptedCount).toBe(1);
    expect(body).not.toHaveProperty("riskLevel");
    expect(body).not.toHaveProperty("severity");
    expect(body).not.toHaveProperty("prediction");
  });

  it("recusa JSON inválido sem acionar ingestão ou worker", async () => {
    const response = await POST(new Request("http://localhost/api/v1/telemetry/thermal-readings", {
      method: "POST",
      headers: { authorization: "Bearer secret", "x-device-id": "device" },
      body: "{invalid",
    }));
    expect(response.status).toBe(400);
    expect(mocks.ingest).not.toHaveBeenCalled();
    expect(mocks.runWorker).not.toHaveBeenCalled();
    expect(mocks.recordTelemetryRequest).toHaveBeenCalledWith(expect.objectContaining({ reasonCode: "INVALID_JSON" }));
  });

  it("recusa payload declarado acima do limite", async () => {
    const response = await POST(new Request("http://localhost/api/v1/telemetry/thermal-readings", {
      method: "POST",
      headers: { authorization: "Bearer secret", "x-device-id": "device", "content-length": "999999" },
      body: "{}",
    }));
    expect(response.status).toBe(413);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
});
