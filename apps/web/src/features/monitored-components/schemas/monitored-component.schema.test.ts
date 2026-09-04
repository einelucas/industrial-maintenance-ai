import { describe, expect, it } from "vitest";
import { monitoredComponentSchema } from "./monitored-component.schema";

const VALID = {
  tag: "cmp-001",
  name: "Contator principal",
  componentType: "CONTACTOR",
  panelId: "11111111-1111-1111-1111-111111111111",
};

describe("monitoredComponentSchema", () => {
  it("aceita entrada válida", () => {
    expect(monitoredComponentSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejeita tipo de componente inválido", () => {
    expect(monitoredComponentSchema.safeParse({ ...VALID, componentType: "MOTOR" }).success).toBe(false);
  });

  it("rejeita painel inválido (não-UUID)", () => {
    expect(monitoredComponentSchema.safeParse({ ...VALID, panelId: "abc" }).success).toBe(false);
  });

  it("rejeita corrente nominal negativa ou zero", () => {
    expect(monitoredComponentSchema.safeParse({ ...VALID, ratedCurrent: "-5" }).success).toBe(false);
    expect(monitoredComponentSchema.safeParse({ ...VALID, ratedCurrent: "0" }).success).toBe(false);
  });

  it("rejeita corrente nominal não finita", () => {
    expect(monitoredComponentSchema.safeParse({ ...VALID, ratedCurrent: "Infinity" }).success).toBe(false);
    expect(monitoredComponentSchema.safeParse({ ...VALID, ratedCurrent: "not-a-number" }).success).toBe(false);
  });

  it("aceita corrente nominal ausente ou vazia", () => {
    expect(monitoredComponentSchema.safeParse(VALID).success).toBe(true);
    expect(monitoredComponentSchema.safeParse({ ...VALID, ratedCurrent: "" }).success).toBe(true);
  });

  it("aceita corrente nominal positiva válida", () => {
    const result = monitoredComponentSchema.parse({ ...VALID, ratedCurrent: "32.5" });
    expect(result.ratedCurrent).toBe(32.5);
  });
});
