import { describe, expect, it } from "vitest";
import { electricalPanelSchema } from "./electrical-panel.schema";

const VALID = {
  tag: "  pnl-aut-001  ",
  name: "Painel Autoclave 01",
  panelType: "MCC",
  sectorId: "11111111-1111-1111-1111-111111111111",
};

describe("electricalPanelSchema", () => {
  it("aceita entrada válida e normaliza a TAG (trim + uppercase)", () => {
    const result = electricalPanelSchema.parse(VALID);
    expect(result.tag).toBe("PNL-AUT-001");
  });

  it("rejeita TAG vazia", () => {
    expect(electricalPanelSchema.safeParse({ ...VALID, tag: "" }).success).toBe(false);
  });

  it("rejeita tipo de painel inválido", () => {
    expect(electricalPanelSchema.safeParse({ ...VALID, panelType: "NOT_A_TYPE" }).success).toBe(false);
  });

  it("rejeita setor inválido (não-UUID)", () => {
    expect(electricalPanelSchema.safeParse({ ...VALID, sectorId: "not-a-uuid" }).success).toBe(false);
  });

  it("aceita equipmentId ausente ou vazio (opcional)", () => {
    expect(electricalPanelSchema.safeParse(VALID).success).toBe(true);
    expect(electricalPanelSchema.safeParse({ ...VALID, equipmentId: "" }).success).toBe(true);
  });

  it("rejeita equipmentId inválido quando informado", () => {
    expect(electricalPanelSchema.safeParse({ ...VALID, equipmentId: "not-a-uuid" }).success).toBe(false);
  });

  it("não aceita campos fora do schema (mass assignment) — active/id/createdAt são ignorados na saída", () => {
    const result = electricalPanelSchema.parse({ ...VALID, active: false, id: "x", createdAt: "2020-01-01" });
    expect(result).not.toHaveProperty("active");
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("createdAt");
  });
});
