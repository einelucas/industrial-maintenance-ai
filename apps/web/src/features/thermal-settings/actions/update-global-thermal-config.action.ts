"use server";

import { revalidatePath } from "next/cache";
import { thermalSettingsService } from "@/features/thermal-settings/services/thermal-settings.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type ThermalConfigFormState = { error?: string; success?: boolean };

export async function updateGlobalThermalConfigAction(
  _prevState: ThermalConfigFormState,
  formData: FormData
): Promise<ThermalConfigFormState> {
  try {
    const user = await requirePermission("thermal-settings:manage");

    const raw = Object.fromEntries(formData.entries());
    const config = await thermalSettingsService.upsertGlobal(raw, user.id);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "ThermalGlobalConfig",
        entityId: config.id,
        action: "UPDATE",
        metadata: {
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
