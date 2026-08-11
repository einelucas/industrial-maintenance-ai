import { auth } from "@/lib/auth/auth";
import { ForbiddenError } from "@/lib/errors";
import { assertCan, type Permission } from "@/lib/permissions/policies";

/** Retorna o usuário autenticado (via Server Component/Action) ou lança erro. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    throw new ForbiddenError("É necessário estar autenticado.");
  }
  return session.user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  assertCan(user.role, permission);
  return user;
}
