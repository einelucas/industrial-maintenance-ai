"use server";

import { revalidatePath } from "next/cache";
import { electricalPanelService } from "@/features/electrical-panels/services/electrical-panel.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";
import type { ElectricalPanelFormState } from "@/features/electrical-panels/actions/create-electrical-panel.action";

export async function updateElectricalPanelAction(
  id: string,
  _prevState: ElectricalPanelFormState,
  formData: FormData
): Promise<ElectricalPanelFormState> {
  try {
    const user = await requirePermission("panel:manage");

    const raw = Object.fromEntries(formData.entries());
    const { updated, sectorChanged, equipmentChanged } = await electricalPanelService.update(id, raw);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "ElectricalPanel",
        entityId: updated.id,
        action: "UPDATE",
        metadata: {
          tag: updated.tag,
          sectorChanged,
          equipmentChanged,
          sectorId: updated.sectorId,
          equipmentId: updated.equipmentId,
        },
      },
    });

    revalidatePath("/electrical-panels");
    revalidatePath(`/electrical-panels/${id}`);
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
