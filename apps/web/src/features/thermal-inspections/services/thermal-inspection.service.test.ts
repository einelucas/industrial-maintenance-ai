import { describe, expect, it } from "vitest";
import { SOURCE_PRIORITY_LABELS } from "./thermal-inspection.service";

describe("contrato da inspeção histórica", () => {
  it("preserva o rótulo ordinal separado do código P", () => {
    expect(SOURCE_PRIORITY_LABELS).toEqual({ P3: "Prioridade 3", P4: "Prioridade 4", P5: "Prioridade 5" });
  });
});
