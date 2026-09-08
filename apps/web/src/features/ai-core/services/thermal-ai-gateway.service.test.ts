import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thermalAiGateway } from "./thermal-ai-gateway.service";
import { AiGatewayError } from "./ai-gateway-error";
import type { ThermalInferenceRequest } from "@/features/ai-core/schemas/thermal-inference-request.schema";

// Testes isolados do gateway de IA térmica (GPMS 2026 / Etapa 5) — `fetch`
// é sempre mockado aqui. Nenhuma chamada de rede real acontece; nenhuma
// dessas respostas simuladas jamais alimenta o banco demonstrativo (isso só
// acontece no service de orquestração, testado separadamente contra um
// banco de teste isolado).

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function validRequest(): ThermalInferenceRequest {
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
    baseline: { meanC: 50, stdDevC: 5, sampleCount: 20, sufficient: true, avgLoadPercent: 60, avgCurrentA: 22 },
    thresholds: { absoluteLimitC: 90, attentionDeltaTC: 10, highDeltaTC: 20, criticalDeltaTC: 30 },
    quality: { sufficientForInference: true, totalHistorySampleCount: 20, aggregatedSignalQuality: 0.95 },
  };
}

const READY_HEALTH_BODY = {
  status: "ok",
  ready: true,
  modelLoaded: true,
  predictorType: "thermal",
  modelStage: "SYNTHETIC_EXPERIMENTAL",
  modelVersion: "thermal-synth-2026.09.01",
  modelChecksum: "sha256:" + "a".repeat(64),
  isSyntheticModel: true,
  featureVersion: "thermal-features-v1",
};

const VALID_PREDICTION_BODY = {
  inferenceId: "inf-1",
  inferenceRequestId: "req-1",
  modelVersion: "thermal-synth-2026.09.01",
  modelChecksum: "sha256:" + "a".repeat(64),
  modelStage: "SYNTHETIC_EXPERIMENTAL",
  modelScore: 92.8,
  riskScore: 96.4,
  riskLevel: "CRITICAL",
  confidence: 0.91,
  predictedFailureMode: "CONTACT_RESISTANCE",
  failureModeConfidence: 0.84,
  explanations: ["ΔT muito acima da referência"],
  recommendedAction: "Inspecionar contator.",
};

describe("thermalAiGateway.checkReadiness", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devolve ready:true quando o health informa um preditor térmico real com estágio permitido", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(READY_HEALTH_BODY));
    const result = await thermalAiGateway.checkReadiness();
    expect(result.ready).toBe(true);
    expect(result.modelStage).toBe("SYNTHETIC_EXPERIMENTAL");
  });

  it("devolve ready:false quando o preditor é o mecânico (demo/sklearn)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "ok", modelLoaded: true, predictorType: "sklearn" }));
    const result = await thermalAiGateway.checkReadiness();
    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/não é um modelo térmico real/i);
  });

  it("devolve ready:false quando modelStage é RULE_ONLY", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...READY_HEALTH_BODY, modelStage: "RULE_ONLY" }));
    const result = await thermalAiGateway.checkReadiness();
    expect(result.ready).toBe(false);
  });

  it("devolve ready:false quando modelLoaded é false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...READY_HEALTH_BODY, modelLoaded: false }));
    const result = await thermalAiGateway.checkReadiness();
    expect(result.ready).toBe(false);
  });

  it("devolve ready:false sem checksum ou com feature version incompatível", async () => {
    const { modelChecksum, ...withoutChecksum } = READY_HEALTH_BODY;
    void modelChecksum;
    fetchMock.mockResolvedValueOnce(jsonResponse(withoutChecksum));
    expect((await thermalAiGateway.checkReadiness()).ready).toBe(false);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...READY_HEALTH_BODY, featureVersion: "thermal-features-v0" }));
    expect((await thermalAiGateway.checkReadiness()).ready).toBe(false);
  });

  it("devolve ready:false em erro HTTP", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 503));
    const result = await thermalAiGateway.checkReadiness();
    expect(result.ready).toBe(false);
  });

  it("devolve ready:false em erro de rede, sem lançar exceção", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await thermalAiGateway.checkReadiness();
    expect(result.ready).toBe(false);
  });
});

describe("thermalAiGateway.predictThermal — fail-closed", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lança NOT_READY e nunca chama o endpoint de predição quando a readiness falha", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "ok", modelLoaded: false, predictorType: "sklearn" }));
    await expect(thermalAiGateway.predictThermal(validRequest())).rejects.toMatchObject({ reason: "NOT_READY" });
    expect(fetchMock).toHaveBeenCalledTimes(1); // só o health, nunca o predict
  });

  it("lança INSUFFICIENT_DATA e nunca chama o endpoint de predição quando quality.sufficientForInference é false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(READY_HEALTH_BODY));
    const request = { ...validRequest(), quality: { ...validRequest().quality, sufficientForInference: false } };
    await expect(thermalAiGateway.predictThermal(request)).rejects.toMatchObject({ reason: "INSUFFICIENT_DATA" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lança HTTP_ERROR quando o endpoint de predição responde com erro", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(READY_HEALTH_BODY)).mockResolvedValueOnce(jsonResponse({}, false, 500));
    await expect(thermalAiGateway.predictThermal(validRequest())).rejects.toMatchObject({ reason: "HTTP_ERROR" });
  });

  it("lança MALFORMED_RESPONSE quando a resposta não bate com o contrato estrito", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(READY_HEALTH_BODY)).mockResolvedValueOnce(jsonResponse({ inferenceId: "x" }));
    await expect(thermalAiGateway.predictThermal(validRequest())).rejects.toMatchObject({ reason: "MALFORMED_RESPONSE" });
  });

  it("lança MALFORMED_RESPONSE quando a resposta tenta usar modelStage DEMO/RULE_ONLY", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(READY_HEALTH_BODY)).mockResolvedValueOnce(jsonResponse({ ...VALID_PREDICTION_BODY, modelStage: "RULE_ONLY" }));
    await expect(thermalAiGateway.predictThermal(validRequest())).rejects.toMatchObject({ reason: "MALFORMED_RESPONSE" });
  });

  it("lança REQUEST_ID_MISMATCH quando o inferenceRequestId da resposta diverge do enviado", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(READY_HEALTH_BODY))
      .mockResolvedValueOnce(jsonResponse({ ...VALID_PREDICTION_BODY, inferenceRequestId: "outro-id" }));
    await expect(thermalAiGateway.predictThermal(validRequest())).rejects.toMatchObject({ reason: "REQUEST_ID_MISMATCH" });
  });

  it("aceita uma resposta válida completa e devolve os dados validados", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(READY_HEALTH_BODY)).mockResolvedValueOnce(jsonResponse(VALID_PREDICTION_BODY));
    const result = await thermalAiGateway.predictThermal(validRequest());
    expect(result.inferenceId).toBe("inf-1");
    expect(result.riskLevel).toBe("CRITICAL");
  });

  it("todo erro lançado é uma instância de AiGatewayError com uma mensagem sanitizada (sem URL/API key)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "ok", modelLoaded: false, predictorType: "sklearn" }));
    try {
      await thermalAiGateway.predictThermal(validRequest());
      expect.fail("deveria ter lançado");
    } catch (error) {
      expect(error).toBeInstanceOf(AiGatewayError);
      const message = (error as AiGatewayError).message;
      expect(message).not.toMatch(/localhost|http|api[_-]?key/i);
    }
  });
});
