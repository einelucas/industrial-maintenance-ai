import type { UserRole } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";

// Único lugar do sistema que sabe "quem pode fazer o quê" (seção 12 do
// escopo). Services/Actions devem chamar `can()` ou `assertCan()` em vez de
// comparar `user.role === "ADMIN"` diretamente.

export type Permission =
  | "user:manage"
  | "settings:manage"
  | "equipment:manage"
  | "sector:manage"
  | "plan:manage"
  | "workorder:manage" // criar/editar/planejar qualquer OS, incl. preditiva
  | "workorder:execute" // técnico: iniciar/atualizar/concluir a própria OS atribuída
  | "workorder:view"
  | "alert:manage" // reconhecer, transformar em OS
  | "dashboard:view"
  | "report:view"
  // Domínio termográfico (GPMS 2026 / Etapa 1)
  | "panel:view"
  | "panel:manage"
  | "thermal-point:view"
  | "thermal-point:manage"
  | "device:view"
  | "device:manage"
  | "incident:view"
  | "incident:acknowledge"
  | "incident:diagnose"
  | "incident:convert-to-work-order"
  | "thermal-settings:manage"
  // Entrada de leituras termográficas (GPMS 2026 / Etapa 4)
  | "thermal-reading:view"
  | "thermal-reading:create"
  | "thermal-reading:import"
  | "thermal-reading:simulate";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "user:manage",
    "settings:manage",
    "equipment:manage",
    "sector:manage",
    "plan:manage",
    "workorder:manage",
    "workorder:execute",
    "workorder:view",
    "alert:manage",
    "dashboard:view",
    "report:view",
    "panel:view",
    "panel:manage",
    "thermal-point:view",
    "thermal-point:manage",
    "device:view",
    "device:manage",
    "incident:view",
    "incident:acknowledge",
    "incident:diagnose",
    "incident:convert-to-work-order",
    "thermal-settings:manage",
    "thermal-reading:view",
    "thermal-reading:create",
    "thermal-reading:import",
    "thermal-reading:simulate",
  ],
  PLANNER: [
    "equipment:manage",
    "sector:manage",
    "plan:manage",
    "workorder:manage",
    "workorder:view",
    "alert:manage",
    "dashboard:view",
    "report:view",
    "panel:view",
    "panel:manage",
    "thermal-point:view",
    "thermal-point:manage",
    "device:view",
    "incident:view",
    "incident:acknowledge",
    "incident:diagnose",
    "incident:convert-to-work-order",
    "thermal-reading:view",
    "thermal-reading:create",
    "thermal-reading:import",
    "thermal-reading:simulate",
  ],
  TECHNICIAN: [
    "workorder:execute",
    "workorder:view",
    "dashboard:view",
    "panel:view",
    "thermal-point:view",
    "device:view",
    "incident:view",
    "incident:acknowledge",
    "incident:diagnose",
    "thermal-reading:view",
    "thermal-reading:create",
  ],
  MANAGER: [
    "workorder:view",
    "dashboard:view",
    "report:view",
    "panel:view",
    "thermal-point:view",
    "device:view",
    "incident:view",
    "thermal-reading:view",
  ],
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertCan(role: UserRole, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError();
  }
}

/** Um técnico só pode operar em OS que estejam atribuídas a ele mesmo. */
export function canOperateWorkOrder(
  role: UserRole,
  userId: string,
  assignedUserId: string | null
): boolean {
  if (can(role, "workorder:manage")) return true;
  if (role === "TECHNICIAN") return assignedUserId === userId;
  return false;
}
