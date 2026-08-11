"use server";

import { revalidatePath } from "next/cache";
import { userService } from "@/features/users/services/user.service";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function toggleActiveUserAction(formData: FormData) {
  const actor = await requirePermission("user:manage");

  const userId = formData.get("userId") as string;
  const nextActive = formData.get("nextActive") === "true";

  const user = await userService.setActive(userId, nextActive, actor.id);

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      entity: "User",
      entityId: user.id,
      action: nextActive ? "ACTIVATE" : "DEACTIVATE",
      metadata: { email: user.email },
    },
  });

  revalidatePath("/users");
}
