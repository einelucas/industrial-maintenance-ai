"use server";

import { revalidatePath } from "next/cache";
import { thermalPointService } from "@/features/thermal-points/services/thermal-point.service";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function toggleActiveThermalPointAction(formData: FormData) {
  const actor = await requirePermission("thermal-point:manage");

  const pointId = formData.get("pointId") as string;
  const nextActive = formData.get("nextActive") === "true";

  const point = nextActive
    ? await thermalPointService.reactivate(pointId)
    : await thermalPointService.deactivate(pointId);

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      entity: "ThermalPoint",
      entityId: point.id,
      action: nextActive ? "ACTIVATE" : "DEACTIVATE",
      metadata: { code: point.code },
    },
  });

  revalidatePath("/thermal-points");
  revalidatePath(`/thermal-points/${pointId}`);
}
