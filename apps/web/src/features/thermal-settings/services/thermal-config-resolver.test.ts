import { describe, expect, it } from "vitest";
import { DEFAULT_THERMAL_THRESHOLDS, resolveEffectiveThermalConfig } from "./thermal-config-resolver";

describe("resolveEffectiveThermalConfig", () => {
  it("usa o padrão versionado quando não há override em nenhum nível", () => {
    const result = resolveEffectiveThermalConfig({}, null, null);
    expect(result.values).toEqual(DEFAULT_THERMAL_THRESHOLDS);
    expect(Object.values(result.sources).every((s) => s === "DEFAULT")).toBe(true);
  });

  it("usa a configuração global quando não há override de tipo nem de ponto", () => {
    const global = { absoluteLimitC: 100, deltaTAttentionC: 12, deltaTHighC: 22, deltaTCriticalC: 32 };
    const result = resolveEffectiveThermalConfig({}, null, global);
    expect(result.values).toEqual(global);
    expect(Object.values(result.sources).every((s) => s === "GLOBAL")).toBe(true);
  });

  it("configuração por tipo de componente tem precedência sobre a global", () => {
    const global = { absoluteLimitC: 100, deltaTAttentionC: 12, deltaTHighC: 22, deltaTCriticalC: 32 };
    const byType = { absoluteLimitC: 80, deltaTAttentionC: 8, deltaTHighC: 18, deltaTCriticalC: 28 };
    const result = resolveEffectiveThermalConfig({}, byType, global);
    expect(result.values).toEqual(byType);
    expect(Object.values(result.sources).every((s) => s === "COMPONENT_TYPE")).toBe(true);
  });

  it("override do ThermalPoint tem precedência sobre tudo", () => {
    const global = { absoluteLimitC: 100, deltaTAttentionC: 12, deltaTHighC: 22, deltaTCriticalC: 32 };
    const byType = { absoluteLimitC: 80, deltaTAttentionC: 8, deltaTHighC: 18, deltaTCriticalC: 28 };
    const point = { absoluteLimitC: 75.6, deltaTAttentionC: 5, deltaTHighC: 15, deltaTCriticalC: 25 };
    const result = resolveEffectiveThermalConfig(point, byType, global);
    expect(result.values).toEqual(point);
    expect(Object.values(result.sources).every((s) => s === "POINT")).toBe(true);
  });

  it("resolve campo a campo — cada nível pode contribuir com valores diferentes simultaneamente", () => {
    const global = { absoluteLimitC: 100, deltaTAttentionC: 12, deltaTHighC: 22, deltaTCriticalC: 32 };
    const byType = { deltaTHighC: 18 }; // só sobrescreve um campo
    const point = { deltaTAttentionC: 5 }; // só sobrescreve outro campo
    const result = resolveEffectiveThermalConfig(point, byType, global);

    expect(result.values.deltaTAttentionC).toBe(5);
    expect(result.sources.deltaTAttentionC).toBe("POINT");

    expect(result.values.deltaTHighC).toBe(18);
    expect(result.sources.deltaTHighC).toBe("COMPONENT_TYPE");

    expect(result.values.absoluteLimitC).toBe(100);
    expect(result.sources.absoluteLimitC).toBe("GLOBAL");

    expect(result.values.deltaTCriticalC).toBe(32);
    expect(result.sources.deltaTCriticalC).toBe("GLOBAL");
  });

  it("garante configuração efetiva completa mesmo para um ponto sem nenhum override — nunca deixa um campo indefinido", () => {
    const result = resolveEffectiveThermalConfig({}, null, null);
    expect(Object.keys(result.values)).toHaveLength(4);
    expect(Object.values(result.values).every((v) => typeof v === "number" && Number.isFinite(v))).toBe(true);
  });

  it("não produz Prediction, incidente ou alerta — retorna apenas números e a origem de cada um", () => {
    const result = resolveEffectiveThermalConfig({}, null, null);
    const keys = Object.keys(result);
    expect(keys).toEqual(["values", "sources", "defaultVersion"]);
  });
});
