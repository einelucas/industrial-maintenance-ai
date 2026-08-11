import { describe, expect, it } from "vitest";
import { can, assertCan, canOperateWorkOrder } from "./policies";
import { ForbiddenError } from "@/lib/errors";

describe("can", () => {
  it("ADMIN tem todas as permissões relevantes de gestão", () => {
    expect(can("ADMIN", "user:manage")).toBe(true);
    expect(can("ADMIN", "equipment:manage")).toBe(true);
    expect(can("ADMIN", "workorder:manage")).toBe(true);
    expect(can("ADMIN", "alert:manage")).toBe(true);
  });

  it("PLANNER pode gerenciar equipamentos, planos, OS e alertas, mas não usuários", () => {
    expect(can("PLANNER", "equipment:manage")).toBe(true);
    expect(can("PLANNER", "plan:manage")).toBe(true);
    expect(can("PLANNER", "workorder:manage")).toBe(true);
    expect(can("PLANNER", "alert:manage")).toBe(true);
    expect(can("PLANNER", "user:manage")).toBe(false);
  });

  it("TECHNICIAN só pode executar OS e ver dashboard, nunca gerenciar", () => {
    expect(can("TECHNICIAN", "workorder:execute")).toBe(true);
    expect(can("TECHNICIAN", "dashboard:view")).toBe(true);
    expect(can("TECHNICIAN", "workorder:manage")).toBe(false);
    expect(can("TECHNICIAN", "equipment:manage")).toBe(false);
    expect(can("TECHNICIAN", "alert:manage")).toBe(false);
  });

  it("MANAGER só visualiza — dashboard, relatórios e OS, nunca gerencia", () => {
    expect(can("MANAGER", "dashboard:view")).toBe(true);
    expect(can("MANAGER", "report:view")).toBe(true);
    expect(can("MANAGER", "workorder:view")).toBe(true);
    expect(can("MANAGER", "workorder:manage")).toBe(false);
    expect(can("MANAGER", "equipment:manage")).toBe(false);
  });
});

describe("assertCan", () => {
  it("não lança erro quando a permissão existe", () => {
    expect(() => assertCan("ADMIN", "user:manage")).not.toThrow();
  });

  it("lança ForbiddenError quando a permissão não existe", () => {
    expect(() => assertCan("TECHNICIAN", "user:manage")).toThrow(ForbiddenError);
  });
});

describe("canOperateWorkOrder", () => {
  it("PLANNER e ADMIN podem operar qualquer OS (têm workorder:manage)", () => {
    expect(canOperateWorkOrder("PLANNER", "planner-1", "tech-99")).toBe(true);
    expect(canOperateWorkOrder("ADMIN", "admin-1", null)).toBe(true);
  });

  it("TECHNICIAN só pode operar OS atribuída a ele mesmo", () => {
    expect(canOperateWorkOrder("TECHNICIAN", "tech-1", "tech-1")).toBe(true);
    expect(canOperateWorkOrder("TECHNICIAN", "tech-1", "tech-2")).toBe(false);
    expect(canOperateWorkOrder("TECHNICIAN", "tech-1", null)).toBe(false);
  });

  it("MANAGER nunca pode operar (não tem workorder:manage nem é TECHNICIAN)", () => {
    expect(canOperateWorkOrder("MANAGER", "mgr-1", "mgr-1")).toBe(false);
  });
});
