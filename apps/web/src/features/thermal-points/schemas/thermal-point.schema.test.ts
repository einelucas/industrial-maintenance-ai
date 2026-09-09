import { describe, expect, it } from "vitest";
import { thermalPointSchema } from "./thermal-point.schema";

const VALID = {
  code: "tp-056",
  name: "Ponto de teste",
  componentId: "11111111-1111-1111-1111-111111111111",
  monitoringMode: "MANUAL",
};

describe("thermalPointSchema", () => {
  it("aceita entrada válida mínima e normaliza o código", () => {
    const result = thermalPointSchema.parse(VALID);
    expect(result.code).toBe("TP-056");
    expect(result.sampleIntervalSec).toBe(60);
  });

  it("rejeita modo de monitoramento inválido", () => {
    expect(thermalPointSchema.safeParse({ ...VALID, monitoringMode: "BLUETOOTH" }).success).toBe(false);
  });

  it("rejeita componente inválido (não-UUID)", () => {
    expect(thermalPointSchema.safeParse({ ...VALID, componentId: "abc" }).success).toBe(false);
  });

  it("rejeita emissividade fora da faixa (0, 1]", () => {
    expect(thermalPointSchema.safeParse({ ...VALID, emissivity: "0" }).success).toBe(false);
    expect(thermalPointSchema.safeParse({ ...VALID, emissivity: "-0.1" }).success).toBe(false);
    expect(thermalPointSchema.safeParse({ ...VALID, emissivity: "1.5" }).success).toBe(false);
  });

  it("aceita emissividade válida no limite (1)", () => {
    expect(thermalPointSchema.safeParse({ ...VALID, emissivity: "1" }).success).toBe(true);
  });

  it("trata campos numéricos vazios como ausência, nunca como zero", () => {
    const result = thermalPointSchema.parse({
      ...VALID,
      emissivity: "",
      absoluteLimitC: "",
      deltaTAttentionC: "",
      deltaTHighC: "",
      deltaTCriticalC: "",
    });
    expect(result.emissivity).toBeUndefined();
    expect(result.absoluteLimitC).toBeUndefined();
    expect(result.deltaTAttentionC).toBeUndefined();
    expect(result.deltaTHighC).toBeUndefined();
    expect(result.deltaTCriticalC).toBeUndefined();
  });

  it("rejeita intervalo de amostragem inválido", () => {
    expect(thermalPointSchema.safeParse({ ...VALID, sampleIntervalSec: "0" }).success).toBe(false);
    expect(thermalPointSchema.safeParse({ ...VALID, sampleIntervalSec: "-5" }).success).toBe(false);
    expect(thermalPointSchema.safeParse({ ...VALID, sampleIntervalSec: "1.5" }).success).toBe(false);
  });

  it("aceita ordem correta dos limites de deltaT", () => {
    const result = thermalPointSchema.safeParse({
      ...VALID,
      deltaTAttentionC: "10",
      deltaTHighC: "20",
      deltaTCriticalC: "30",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita ordem incorreta: atenção >= alto", () => {
    const result = thermalPointSchema.safeParse({ ...VALID, deltaTAttentionC: "20", deltaTHighC: "20" });
    expect(result.success).toBe(false);
  });

  it("rejeita ordem incorreta: alto >= crítico", () => {
    const result = thermalPointSchema.safeParse({ ...VALID, deltaTHighC: "30", deltaTCriticalC: "25" });
    expect(result.success).toBe(false);
  });

  it("valida ordem parcial (atenção < crítico) mesmo sem o limite alto informado", () => {
    const ok = thermalPointSchema.safeParse({ ...VALID, deltaTAttentionC: "10", deltaTCriticalC: "30" });
    expect(ok.success).toBe(true);
    const bad = thermalPointSchema.safeParse({ ...VALID, deltaTAttentionC: "30", deltaTCriticalC: "10" });
    expect(bad.success).toBe(false);
  });

  it("nunca aceita campos de risco/diagnóstico/IA — são descartados silenciosamente", () => {
    const result = thermalPointSchema.parse({
      ...VALID,
      initiallyAnomalous: true,
      riskScore: 99,
      riskLevel: "CRITICAL",
      severity: "CRITICAL",
      diagnosis: "forjado",
      cause: "OVERLOAD",
      predictedClass: 1,
      failureProbability: 0.9,
    });
    expect(result).not.toHaveProperty("initiallyAnomalous");
    expect(result).not.toHaveProperty("riskScore");
    expect(result).not.toHaveProperty("riskLevel");
    expect(result).not.toHaveProperty("severity");
    expect(result).not.toHaveProperty("diagnosis");
    expect(result).not.toHaveProperty("cause");
    expect(result).not.toHaveProperty("predictedClass");
    expect(result).not.toHaveProperty("failureProbability");
  });
});
