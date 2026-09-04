"use server";

import { revalidatePath } from "next/cache";
import { thermalPointService } from "@/features/thermal-points/services/thermal-point.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";
import type { ThermalPointFormState } from "@/features/thermal-points/actions/create-thermal-point.action";

export async function updateThermalPointAction(
  id: string,
  _prevState: ThermalPointFormState,
  formData: FormData
): Promise<ThermalPointFormState> {
  try {
    const user = await requirePermission("thermal-point:manage");

    const raw = Object.fromEntries(formData.entries());
    const point = await thermalPointService.update(id, raw);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "ThermalPoint",
        entityId: point.id,
        action: "UPDATE",
        metadata: {
          code: point.code,
          deltaTAttentionC: point.deltaTAttentionC,
          deltaTHighC: point.deltaTHighC,
          deltaTCriticalC: point.deltaTCriticalC,
        },
      },
    });

    revalidatePath("/thermal-points");
    revalidatePath(`/thermal-points/${id}`);
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
