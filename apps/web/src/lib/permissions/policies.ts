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
  | "report:view";

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
  ],
  TECHNICIAN: ["workorder:execute", "workorder:view", "dashboard:view"],
  MANAGER: ["workorder:view", "dashboard:view", "report:view"],
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
