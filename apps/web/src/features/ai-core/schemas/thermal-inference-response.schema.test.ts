import { describe, expect, it } from "vitest";
import { thermalInferenceResponseSchema, thermalReadinessResponseSchema } from "./thermal-inference-response.schema";

const validResponse = {
  inferenceId: "inf-123",
  inferenceRequestId: "req-abc",
  modelVersion: "thermal-synth-2026.09.01",
  modelChecksum: "sha256:" + "a".repeat(64),
  modelStage: "SYNTHETIC_EXPERIMENTAL",
  modelScore: 92.8,
  riskScore: 96.4,
  riskLevel: "CRITICAL",
  confidence: 0.91,
  predictedFailureMode: "CONTACT_RESISTANCE",
  failureModeConfidence: 0.84,
  explanations: ["ΔT 35,6 °C acima da referência"],
  recommendedAction: "Inspecionar contator.",
};

describe("thermalInferenceResponseSchema — aceitação", () => {
  it("aceita uma resposta válida completa", () => {
    expect(thermalInferenceResponseSchema.safeParse(validResponse).success).toBe(true);
  });

  it("aceita failureModeConfidence e recommendedAction como null", () => {
    const result = thermalInferenceResponseSchema.safeParse({ ...validResponse, failureModeConfidence: null, recommendedAction: null });
    expect(result.success).toBe(true);
  });
});

describe("thermalInferenceResponseSchema — estágios de modelo", () => {
  it.each(["PLANT_CALIBRATION", "PLANT_VALIDATED"])("aceita o estágio permitido %s", (modelStage) => {
    expect(thermalInferenceResponseSchema.safeParse({ ...validResponse, modelStage }).success).toBe(true);
  });

  it.each(["RULE_ONLY", "DEMO", "UNKNOWN", ""])("rejeita o estágio não permitido %s", (modelStage) => {
    expect(thermalInferenceResponseSchema.safeParse({ ...validResponse, modelStage }).success).toBe(false);
  });
});

describe("thermalInferenceResponseSchema — faixas numéricas", () => {
  it("rejeita modelScore fora de [0, 100]", () => {
    expect(thermalInferenceResponseSchema.safeParse({ ...validResponse, modelScore: 101 }).success).toBe(false);
    expect(thermalInferenceResponseSchema.safeParse({ ...validResponse, modelScore: -1 }).success).toBe(false);
  });

  it("rejeita riskScore fora de [0, 100]", () => {
    expect(thermalInferenceResponseSchema.safeParse({ ...validResponse, riskScore: 150 }).success).toBe(false);
  });

  it("rejeita confidence fora de [0, 1]", () => {
    expect(thermalInferenceResponseSchema.safeParse({ ...validResponse, confidence: 1.5 }).success).toBe(false);
  });
});

describe("thermalInferenceResponseSchema — checksum", () => {
  it("rejeita checksum fora do formato sha256:<64 hex>", () => {
    expect(thermalInferenceResponseSchema.safeParse({ ...validResponse, modelChecksum: "not-a-checksum" }).success).toBe(false);
    expect(thermalInferenceResponseSchema.safeParse({ ...validResponse, modelChecksum: "sha256:abc" }).success).toBe(false);
  });
});

describe("thermalInferenceResponseSchema — explicações", () => {
  it("rejeita explanations vazio", () => {
    expect(thermalInferenceResponseSchema.safeParse({ ...validResponse, explanations: [] }).success).toBe(false);
  });
});

describe("thermalInferenceResponseSchema — payload estrito", () => {
  it("rejeita campo extra fora do contrato (ex.: severity/diagnosis inventados)", () => {
    const result = thermalInferenceResponseSchema.safeParse({ ...validResponse, severity: "CRITICAL", diagnosis: "algo" });
    expect(result.success).toBe(false);
  });

  it("rejeita campos obrigatórios ausentes", () => {
    const { inferenceId, ...withoutId } = validResponse;
    void inferenceId;
    expect(thermalInferenceResponseSchema.safeParse(withoutId).success).toBe(false);
  });
});

describe("thermalReadinessResponseSchema", () => {
  it("aceita o contrato mecânico atual sem quebrar o parse (predictorType demo/sklearn)", () => {
    const result = thermalReadinessResponseSchema.safeParse({ status: "ok", appVersion: "1.0.0", modelLoaded: true, predictorType: "demo" });
    expect(result.success).toBe(true);
  });

  it("aceita um payload vazio (health check indisponível/inesperado) sem lançar", () => {
    expect(thermalReadinessResponseSchema.safeParse({}).success).toBe(true);
  });
});
