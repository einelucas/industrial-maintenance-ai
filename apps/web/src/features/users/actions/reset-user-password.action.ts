"use server";

import { userService } from "@/features/users/services/user.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type ResetPasswordFormState = { error?: string; success?: boolean };

export async function resetUserPasswordAction(
  userId: string,
  _prevState: ResetPasswordFormState,
  formData: FormData
): Promise<ResetPasswordFormState> {
  try {
    const actor = await requirePermission("user:manage");
    const raw = Object.fromEntries(formData.entries());
    await userService.resetPassword(userId, raw);

    await prisma.auditLog.create({
      data: { userId: actor.id, entity: "User", entityId: userId, action: "RESET_PASSWORD" },
    });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  return { success: true };
}
