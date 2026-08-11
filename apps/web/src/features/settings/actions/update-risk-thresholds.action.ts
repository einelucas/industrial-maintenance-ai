"use server";

import { revalidatePath } from "next/cache";
import { riskThresholdService } from "@/features/settings/services/risk-threshold.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type RiskThresholdFormState = { error?: string; success?: boolean };

export async function updateRiskThresholdsAction(
  _prevState: RiskThresholdFormState,
  formData: FormData
): Promise<RiskThresholdFormState> {
  try {
    const user = await requirePermission("settings:manage");

    const raw = Object.fromEntries(formData.entries());
    const updated = await riskThresholdService.update(raw, user.id);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "RiskThresholdConfig",
        entityId: "default",
        action: "UPDATE",
        metadata: { lowMax: updated.lowMax, moderateMax: updated.moderateMax, highMax: updated.highMax },
      },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
