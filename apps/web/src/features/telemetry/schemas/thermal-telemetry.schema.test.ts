import { describe, expect, it } from "vitest";
import { thermalTelemetryEnvelopeSchema, thermalTelemetryReadingSchema } from "./thermal-telemetry.schema";

const valid = {
  sequence: 1,
  thermalPointCode: "TP-001",
  measuredAt: "2026-09-09T12:00:00.000Z",
  temperatureMaxC: 45.2,
  referenceTemperatureC: 38,
};

describe("contrato de telemetria térmica", () => {
  it("aceita envelope versionado e item físico sem campos analíticos", () => {
    expect(thermalTelemetryEnvelopeSchema.safeParse({ schemaVersion: "thermal-telemetry-v1", readings: [valid] }).success).toBe(true);
    expect(thermalTelemetryReadingSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita risco, severidade ou diagnóstico enviados pelo dispositivo", () => {
    expect(thermalTelemetryReadingSchema.safeParse({ ...valid, riskLevel: "CRITICAL" }).success).toBe(false);
    expect(thermalTelemetryReadingSchema.safeParse({ ...valid, diagnosis: "Falha" }).success).toBe(false);
  });

  it("rejeita sequência insegura e grandezas fora dos limites físicos", () => {
    expect(thermalTelemetryReadingSchema.safeParse({ ...valid, sequence: Number.MAX_SAFE_INTEGER + 1 }).success).toBe(false);
    expect(thermalTelemetryReadingSchema.safeParse({ ...valid, temperatureMaxC: 1000 }).success).toBe(false);
  });
});
