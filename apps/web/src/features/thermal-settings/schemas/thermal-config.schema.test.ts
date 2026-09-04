import { describe, expect, it } from "vitest";
import { componentTypeThermalConfigSchema, globalThermalConfigSchema } from "./thermal-config.schema";

describe("globalThermalConfigSchema", () => {
  const VALID = { absoluteLimitC: "90", deltaTAttentionC: "10", deltaTHighC: "20", deltaTCriticalC: "30" };

  it("aceita entrada válida com ordem correta", () => {
    expect(globalThermalConfigSchema.safeParse(VALID).success).toBe(true);
  });

  it("exige todos os quatro limites (não são opcionais no escopo global)", () => {
    const { deltaTCriticalC: _omit, ...rest } = VALID;
    expect(globalThermalConfigSchema.safeParse(rest).success).toBe(false);
  });

  it("rejeita ordem incorreta entre os limites", () => {
    expect(globalThermalConfigSchema.safeParse({ ...VALID, deltaTHighC: "5" }).success).toBe(false);
  });

  it("rejeita valores não positivos", () => {
    expect(globalThermalConfigSchema.safeParse({ ...VALID, absoluteLimitC: "0" }).success).toBe(false);
    expect(globalThermalConfigSchema.safeParse({ ...VALID, absoluteLimitC: "-10" }).success).toBe(false);
  });
});

describe("componentTypeThermalConfigSchema", () => {
  it("aceita override parcial (só alguns campos, os demais ausentes)", () => {
    const result = componentTypeThermalConfigSchema.safeParse({ componentType: "CONTACTOR", deltaTHighC: "18" });
    expect(result.success).toBe(true);
  });

  it("rejeita tipo de componente inválido", () => {
    expect(componentTypeThermalConfigSchema.safeParse({ componentType: "MOTOR" }).success).toBe(false);
  });

  it("valida ordem apenas entre os campos informados", () => {
    const ok = componentTypeThermalConfigSchema.safeParse({
      componentType: "CONTACTOR",
      deltaTAttentionC: "10",
      deltaTCriticalC: "30",
    });
    expect(ok.success).toBe(true);

    const bad = componentTypeThermalConfigSchema.safeParse({
      componentType: "CONTACTOR",
      deltaTAttentionC: "30",
      deltaTCriticalC: "10",
    });
    expect(bad.success).toBe(false);
  });

  it("não aceita risco, severidade ou diagnóstico — campos fora do schema são descartados", () => {
    const result = componentTypeThermalConfigSchema.parse({
      componentType: "CONTACTOR",
      riskLevel: "CRITICAL",
      diagnosis: "forjado",
    });
    expect(result).not.toHaveProperty("riskLevel");
    expect(result).not.toHaveProperty("diagnosis");
  });
});
