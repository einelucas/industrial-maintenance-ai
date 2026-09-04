"use server";

import { revalidatePath } from "next/cache";
import { thermalPointService } from "@/features/thermal-points/services/thermal-point.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type ThermalPointFormState = { error?: string; success?: boolean };

export async function createThermalPointAction(
  _prevState: ThermalPointFormState,
  formData: FormData
): Promise<ThermalPointFormState> {
  try {
    const user = await requirePermission("thermal-point:manage");

    const raw = Object.fromEntries(formData.entries());
    const point = await thermalPointService.create(raw);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "ThermalPoint",
        entityId: point.id,
        action: "CREATE",
        metadata: { code: point.code, componentId: point.componentId },
      },
    });

    revalidatePath("/thermal-points");
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
