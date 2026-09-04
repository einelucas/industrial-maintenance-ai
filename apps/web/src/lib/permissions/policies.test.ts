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

describe("can — domínio termográfico (GPMS 2026 / Etapa 1)", () => {
  it("ADMIN pode tudo no domínio térmico", () => {
    expect(can("ADMIN", "panel:view")).toBe(true);
    expect(can("ADMIN", "panel:manage")).toBe(true);
    expect(can("ADMIN", "thermal-point:view")).toBe(true);
    expect(can("ADMIN", "thermal-point:manage")).toBe(true);
    expect(can("ADMIN", "device:view")).toBe(true);
    expect(can("ADMIN", "device:manage")).toBe(true);
    expect(can("ADMIN", "incident:view")).toBe(true);
    expect(can("ADMIN", "incident:acknowledge")).toBe(true);
    expect(can("ADMIN", "incident:diagnose")).toBe(true);
    expect(can("ADMIN", "incident:convert-to-work-order")).toBe(true);
    expect(can("ADMIN", "thermal-settings:manage")).toBe(true);
  });

  it("PLANNER gerencia painéis e pontos, visualiza dispositivos e conduz incidentes até a OS, mas não gerencia dispositivos nem configurações térmicas", () => {
    expect(can("PLANNER", "panel:view")).toBe(true);
    expect(can("PLANNER", "panel:manage")).toBe(true);
    expect(can("PLANNER", "thermal-point:view")).toBe(true);
    expect(can("PLANNER", "thermal-point:manage")).toBe(true);
    expect(can("PLANNER", "device:view")).toBe(true);
    expect(can("PLANNER", "incident:view")).toBe(true);
    expect(can("PLANNER", "incident:acknowledge")).toBe(true);
    expect(can("PLANNER", "incident:diagnose")).toBe(true);
    expect(can("PLANNER", "incident:convert-to-work-order")).toBe(true);
    expect(can("PLANNER", "device:manage")).toBe(false);
    expect(can("PLANNER", "thermal-settings:manage")).toBe(false);
  });

  it("TECHNICIAN visualiza painéis/pontos/dispositivos/incidentes e reconhece/diagnostica, mas não gerencia cadastro nem converte incidente em OS", () => {
    expect(can("TECHNICIAN", "panel:view")).toBe(true);
    expect(can("TECHNICIAN", "thermal-point:view")).toBe(true);
    expect(can("TECHNICIAN", "device:view")).toBe(true);
    expect(can("TECHNICIAN", "incident:view")).toBe(true);
    expect(can("TECHNICIAN", "incident:acknowledge")).toBe(true);
    expect(can("TECHNICIAN", "incident:diagnose")).toBe(true);
    expect(can("TECHNICIAN", "panel:manage")).toBe(false);
    expect(can("TECHNICIAN", "thermal-point:manage")).toBe(false);
    expect(can("TECHNICIAN", "device:manage")).toBe(false);
    expect(can("TECHNICIAN", "incident:convert-to-work-order")).toBe(false);
    expect(can("TECHNICIAN", "thermal-settings:manage")).toBe(false);
  });

  it("MANAGER apenas visualiza painéis, pontos, dispositivos e incidentes térmicos", () => {
    expect(can("MANAGER", "panel:view")).toBe(true);
    expect(can("MANAGER", "thermal-point:view")).toBe(true);
    expect(can("MANAGER", "device:view")).toBe(true);
    expect(can("MANAGER", "incident:view")).toBe(true);
    expect(can("MANAGER", "panel:manage")).toBe(false);
    expect(can("MANAGER", "thermal-point:manage")).toBe(false);
    expect(can("MANAGER", "device:manage")).toBe(false);
    expect(can("MANAGER", "incident:acknowledge")).toBe(false);
    expect(can("MANAGER", "incident:diagnose")).toBe(false);
    expect(can("MANAGER", "incident:convert-to-work-order")).toBe(false);
    expect(can("MANAGER", "thermal-settings:manage")).toBe(false);
  });
});

describe("can — entrada de leituras termográficas (GPMS 2026 / Etapa 4)", () => {
  it("ADMIN e PLANNER podem ver, registrar manualmente, importar CSV e rodar o simulador", () => {
    for (const role of ["ADMIN", "PLANNER"] as const) {
      expect(can(role, "thermal-reading:view")).toBe(true);
      expect(can(role, "thermal-reading:create")).toBe(true);
      expect(can(role, "thermal-reading:import")).toBe(true);
      expect(can(role, "thermal-reading:simulate")).toBe(true);
    }
  });

  it("TECHNICIAN vê e registra manualmente (calibração/inspeção em campo), mas não importa CSV nem roda o simulador", () => {
    expect(can("TECHNICIAN", "thermal-reading:view")).toBe(true);
    expect(can("TECHNICIAN", "thermal-reading:create")).toBe(true);
    expect(can("TECHNICIAN", "thermal-reading:import")).toBe(false);
    expect(can("TECHNICIAN", "thermal-reading:simulate")).toBe(false);
  });

  it("MANAGER só visualiza o histórico de leituras", () => {
    expect(can("MANAGER", "thermal-reading:view")).toBe(true);
    expect(can("MANAGER", "thermal-reading:create")).toBe(false);
    expect(can("MANAGER", "thermal-reading:import")).toBe(false);
    expect(can("MANAGER", "thermal-reading:simulate")).toBe(false);
  });
});

describe("assertCan — domínio termográfico", () => {
  it("lança ForbiddenError quando a ação térmica é proibida para o papel", () => {
    expect(() => assertCan("TECHNICIAN", "device:manage")).toThrow(ForbiddenError);
    expect(() => assertCan("MANAGER", "incident:acknowledge")).toThrow(ForbiddenError);
    expect(() => assertCan("PLANNER", "thermal-settings:manage")).toThrow(ForbiddenError);
  });

  it("não lança erro quando a ação térmica é permitida para o papel", () => {
    expect(() => assertCan("ADMIN", "thermal-settings:manage")).not.toThrow();
    expect(() => assertCan("PLANNER", "incident:convert-to-work-order")).not.toThrow();
    expect(() => assertCan("TECHNICIAN", "incident:diagnose")).not.toThrow();
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
