import { describe, expect, it } from "vitest";
import { thermalInferenceRequestSchema } from "./thermal-inference-request.schema";

function validRequest() {
  return {
    inferenceRequestId: "req-1",
    thermalReadingId: "123e4567-e89b-12d3-a456-426614174000",
    thermalPointId: "123e4567-e89b-12d3-a456-426614174001",
    componentType: "CONTACTOR",
    featureVersion: "thermal-features-v1",
    current: {
      temperatureMaxC: 75.6,
      temperatureAverageC: 70,
      ambientTemperatureC: 28,
      referenceTemperatureC: 40,
      deltaTC: 35.6,
      currentA: 30,
      loadPercent: 80,
      signalQuality: 0.95,
      measuredAt: "2026-09-04T12:00:00.000Z",
    },
    window: {
      mean5mC: 75,
      mean5mSampleCount: 1,
      mean15mC: 74,
      mean15mSampleCount: 1,
      mean60mC: 70,
      mean60mSampleCount: 3,
      max1hC: 75.6,
      max6hC: 75.6,
      max24hC: 75.6,
      trendCPerHour: 15,
      trendSampleCount: 3,
      timeAboveLimitMin: 60,
      consecutiveAnomalousCount: 2,
      minutesSinceLastValidReading: 60,
    },
    baseline: {
      meanC: 50,
      stdDevC: 5,
      sampleCount: 20,
      sufficient: true,
      avgLoadPercent: 60,
      avgCurrentA: 22,
    },
    thresholds: {
      absoluteLimitC: 90,
      attentionDeltaTC: 10,
      highDeltaTC: 20,
      criticalDeltaTC: 30,
    },
    quality: {
      sufficientForInference: true,
      totalHistorySampleCount: 20,
      aggregatedSignalQuality: 0.95,
    },
  };
}

describe("thermalInferenceRequestSchema — aceitação", () => {
  it("aceita um payload válido completo", () => {
    expect(thermalInferenceRequestSchema.safeParse(validRequest()).success).toBe(true);
  });

  it("aceita valores null nos campos opcionais de current/window/baseline/thresholds", () => {
    const request = validRequest();
    request.current.temperatureAverageC = null as unknown as number;
    request.window.trendCPerHour = null as unknown as number;
    request.baseline.meanC = null as unknown as number;
    request.thresholds.absoluteLimitC = null as unknown as number;
    expect(thermalInferenceRequestSchema.safeParse(request).success).toBe(true);
  });
});

describe("thermalInferenceRequestSchema — proibição estrutural de campos analíticos/ground truth", () => {
  it("rejeita o payload inteiro se qualquer campo fora do contrato for incluído", () => {
    const withExtra = { ...validRequest(), initiallyAnomalous: true };
    expect(thermalInferenceRequestSchema.safeParse(withExtra).success).toBe(false);
  });

  it("rejeita causa verdadeira do simulador ou classificação esperada injetada no nível raiz", () => {
    const withExtra = { ...validRequest(), trueCause: "LOOSE_CONNECTION", expectedRiskLevel: "CRITICAL" };
    expect(thermalInferenceRequestSchema.safeParse(withExtra).success).toBe(false);
  });

  it("rejeita campo extra dentro de `current` (ex.: um score já calculado)", () => {
    const request = validRequest();
    (request.current as Record<string, unknown>).precomputedRiskScore = 99;
    expect(thermalInferenceRequestSchema.safeParse(request).success).toBe(false);
  });
});

describe("thermalInferenceRequestSchema — validação estrutural", () => {
  it("rejeita thermalPointId que não é UUID", () => {
    const request = { ...validRequest(), thermalPointId: "not-a-uuid" };
    expect(thermalInferenceRequestSchema.safeParse(request).success).toBe(false);
  });

  it("rejeita componentType fora do enum", () => {
    const request = { ...validRequest(), componentType: "TURBINE" };
    expect(thermalInferenceRequestSchema.safeParse(request).success).toBe(false);
  });

  it("rejeita inferenceRequestId vazio", () => {
    const request = { ...validRequest(), inferenceRequestId: "" };
    expect(thermalInferenceRequestSchema.safeParse(request).success).toBe(false);
  });
});
