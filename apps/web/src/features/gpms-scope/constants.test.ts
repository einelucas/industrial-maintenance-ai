import { describe, expect, it } from "vitest";
import {
  GPMS_EXPECTED_ORIGINAL_DISTRIBUTION,
  GPMS_ORIGINAL_CLASSIFICATIONS,
  GPMS_SCOPE,
} from "./constants";

describe("contrato visual do escopo GPMS 2026", () => {
  it("preserva os números oficiais do desafio", () => {
    expect(GPMS_SCOPE.inspectedPoints).toBe(55);
    expect(GPMS_SCOPE.historicalAnomalies).toBe(19);
    expect(GPMS_SCOPE.criticalTemperatureC).toBe(75.6);
    expect(GPMS_SCOPE.criticalReferenceTemperatureC).toBe(40);
    expect(GPMS_SCOPE.criticalDeltaTC).toBe(35.6);
    expect(GPMS_SCOPE.minimumCentrifuges).toBe(20);
  });

  it("mantém a classificação original separada da prioridade empresarial", () => {
    expect(GPMS_ORIGINAL_CLASSIFICATIONS).toEqual([
      expect.objectContaining({ sourceLabel: "Prioridade 3", companyPriority: "P20", expectedCount: 2 }),
      expect.objectContaining({ sourceLabel: "Prioridade 4", companyPriority: "P10", expectedCount: 10 }),
      expect.objectContaining({ sourceLabel: "Prioridade 5", companyPriority: "P5", expectedCount: 7 }),
    ]);
    expect(Object.values(GPMS_EXPECTED_ORIGINAL_DISTRIBUTION).reduce<number>((total, count) => total + count, 0)).toBe(19);
  });
});
