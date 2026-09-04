"use server";

import { revalidatePath } from "next/cache";
import { electricalPanelService } from "@/features/electrical-panels/services/electrical-panel.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type ElectricalPanelFormState = { error?: string; success?: boolean };

export async function createElectricalPanelAction(
  _prevState: ElectricalPanelFormState,
  formData: FormData
): Promise<ElectricalPanelFormState> {
  try {
    const user = await requirePermission("panel:manage");

    const raw = Object.fromEntries(formData.entries());
    const panel = await electricalPanelService.create(raw);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "ElectricalPanel",
        entityId: panel.id,
        action: "CREATE",
        metadata: { tag: panel.tag, sectorId: panel.sectorId, equipmentId: panel.equipmentId },
      },
    });

    revalidatePath("/electrical-panels");
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
