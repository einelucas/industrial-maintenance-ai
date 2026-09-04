"use server";

import { revalidatePath } from "next/cache";
import { thermalSettingsService } from "@/features/thermal-settings/services/thermal-settings.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";
import type { ThermalConfigFormState } from "@/features/thermal-settings/actions/update-global-thermal-config.action";

export async function updateComponentTypeThermalConfigAction(
  _prevState: ThermalConfigFormState,
  formData: FormData
): Promise<ThermalConfigFormState> {
  try {
    const user = await requirePermission("thermal-settings:manage");

    const raw = Object.fromEntries(formData.entries());
    const config = await thermalSettingsService.upsertComponentType(raw, user.id);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "ThermalComponentTypeConfig",
        entityId: config.id,
        action: "UPDATE",
        metadata: {
          componentType: config.componentType,
          absoluteLimitC: config.absoluteLimitC,
          deltaTAttentionC: config.deltaTAttentionC,
          deltaTHighC: config.deltaTHighC,
          deltaTCriticalC: config.deltaTCriticalC,
        },
      },
    });

    revalidatePath("/settings/thermal");
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
