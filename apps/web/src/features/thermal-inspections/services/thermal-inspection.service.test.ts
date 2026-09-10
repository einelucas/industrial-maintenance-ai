import { describe, expect, it } from "vitest";
import { EXPECTED_ORIGINAL_DISTRIBUTION, SOURCE_PRIORITY_LABELS } from "./thermal-inspection.service";

describe("contrato da inspeção original", () => {
  it("preserva os 19 achados e a distribuição 2/10/7", () => {
    expect(Object.values(EXPECTED_ORIGINAL_DISTRIBUTION).reduce((sum, value) => sum + value, 0)).toBe(19);
    expect(EXPECTED_ORIGINAL_DISTRIBUTION.P20).toBe(2);
    expect(EXPECTED_ORIGINAL_DISTRIBUTION.P10).toBe(10);
    expect(EXPECTED_ORIGINAL_DISTRIBUTION.P5).toBe(7);
  });

  it("preserva o rótulo ordinal separado do código P", () => {
    expect(SOURCE_PRIORITY_LABELS).toEqual({ P3: "Prioridade 3", P4: "Prioridade 4", P5: "Prioridade 5" });
  });
});
