"use server";

import { revalidatePath } from "next/cache";
import { userService } from "@/features/users/services/user.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type UserFormState = { error?: string; success?: boolean };

export async function createUserAction(_prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  try {
    const actor = await requirePermission("user:manage");

    const raw = Object.fromEntries(formData.entries());
    const user = await userService.create(raw);

    await prisma.auditLog.create({
      data: { userId: actor.id, entity: "User", entityId: user.id, action: "CREATE", metadata: { email: user.email } },
    });

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
