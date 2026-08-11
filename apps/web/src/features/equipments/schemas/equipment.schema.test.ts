import { describe, expect, it } from "vitest";
import { equipmentSchema } from "./equipment.schema";

describe("equipmentSchema", () => {
  const valid = {
    tag: "MTR-999",
    name: "Motor de Teste",
    category: "Motor",
    criticality: "HIGH",
    status: "OPERATIONAL",
    sectorId: "123e4567-e89b-12d3-a456-426614174000",
  };

  it("aceita um payload válido mínimo", () => {
    expect(equipmentSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita TAG vazia", () => {
    expect(equipmentSchema.safeParse({ ...valid, tag: "" }).success).toBe(false);
  });

  it("rejeita nome muito curto", () => {
    expect(equipmentSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
  });

  it("rejeita criticidade fora do enum", () => {
    expect(equipmentSchema.safeParse({ ...valid, criticality: "SUPER_HIGH" }).success).toBe(false);
  });

  it("rejeita sectorId que não é UUID", () => {
    expect(equipmentSchema.safeParse({ ...valid, sectorId: "not-a-uuid" }).success).toBe(false);
  });

  it("campos opcionais podem ser omitidos", () => {
    const result = equipmentSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});
