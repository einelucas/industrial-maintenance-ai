import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/client";
import { ForbiddenError } from "@/lib/errors";
import { assertCan, type Permission } from "@/lib/permissions/policies";

/**
 * Retorna o usuário autenticado e ainda ativo no banco.
 *
 * A sessão é JWT e pode sobreviver a uma troca/restauração do banco. Nessa
 * situação, confiar apenas no id guardado no cookie faria as escritas com FK
 * (como AuditLog.userId) falharem depois que a operação principal já ocorreu.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ForbiddenError("É necessário estar autenticado.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  if (!user?.active) {
    throw new ForbiddenError("Sua sessão não é mais válida. Saia e entre novamente.");
  }

  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  assertCan(user.role, permission);
  return user;
}
