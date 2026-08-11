import { describe, expect, it } from "vitest";
import { VALID_TRANSITIONS, createWorkOrderSchema, workOrderStatusTransitionSchema } from "./work-order.schema";

describe("VALID_TRANSITIONS (máquina de estados da OS)", () => {
  it("permite o fluxo feliz completo: OPEN → PLANNED → IN_PROGRESS → COMPLETED", () => {
    expect(VALID_TRANSITIONS.OPEN).toContain("PLANNED");
    expect(VALID_TRANSITIONS.PLANNED).toContain("IN_PROGRESS");
    expect(VALID_TRANSITIONS.IN_PROGRESS).toContain("COMPLETED");
  });

  it("permite cancelar a partir de qualquer estado ativo", () => {
    expect(VALID_TRANSITIONS.OPEN).toContain("CANCELED");
    expect(VALID_TRANSITIONS.PLANNED).toContain("CANCELED");
    expect(VALID_TRANSITIONS.IN_PROGRESS).toContain("CANCELED");
    expect(VALID_TRANSITIONS.WAITING_MATERIAL).toContain("CANCELED");
    expect(VALID_TRANSITIONS.PAUSED).toContain("CANCELED");
  });

  it("não permite nenhuma transição a partir de estados finais", () => {
    expect(VALID_TRANSITIONS.COMPLETED).toEqual([]);
    expect(VALID_TRANSITIONS.CANCELED).toEqual([]);
  });

  it("não permite pular direto de OPEN para COMPLETED sem passar por IN_PROGRESS", () => {
    expect(VALID_TRANSITIONS.OPEN).not.toContain("COMPLETED");
  });

  it("permite retomar de WAITING_MATERIAL e PAUSED para IN_PROGRESS", () => {
    expect(VALID_TRANSITIONS.WAITING_MATERIAL).toContain("IN_PROGRESS");
    expect(VALID_TRANSITIONS.PAUSED).toContain("IN_PROGRESS");
  });
});

describe("workOrderStatusTransitionSchema", () => {
  it("aceita um payload válido", () => {
    const result = workOrderStatusTransitionSchema.safeParse({
      workOrderId: "123e4567-e89b-12d3-a456-426614174000",
      newStatus: "IN_PROGRESS",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita um status inexistente", () => {
    const result = workOrderStatusTransitionSchema.safeParse({
      workOrderId: "123e4567-e89b-12d3-a456-426614174000",
      newStatus: "NOT_A_REAL_STATUS",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita um workOrderId que não é UUID", () => {
    const result = workOrderStatusTransitionSchema.safeParse({
      workOrderId: "not-a-uuid",
      newStatus: "IN_PROGRESS",
    });
    expect(result.success).toBe(false);
  });
});

describe("createWorkOrderSchema", () => {
  const validBase = {
    title: "Verificar vibração anormal",
    type: "CORRECTIVE",
    priority: "HIGH",
    equipmentId: "123e4567-e89b-12d3-a456-426614174000",
  };

  it("aceita um payload mínimo válido", () => {
    expect(createWorkOrderSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejeita título muito curto", () => {
    const result = createWorkOrderSchema.safeParse({ ...validBase, title: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejeita equipmentId inválido", () => {
    const result = createWorkOrderSchema.safeParse({ ...validBase, equipmentId: "abc" });
    expect(result.success).toBe(false);
  });

  it("coage estimatedHours de string para número", () => {
    const result = createWorkOrderSchema.safeParse({ ...validBase, estimatedHours: "4.5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estimatedHours).toBe(4.5);
    }
  });
});
