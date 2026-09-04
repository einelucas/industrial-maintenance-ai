"use server";

import { revalidatePath } from "next/cache";
import { electricalPanelService } from "@/features/electrical-panels/services/electrical-panel.service";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function toggleActiveElectricalPanelAction(formData: FormData) {
  const actor = await requirePermission("panel:manage");

  const panelId = formData.get("panelId") as string;
  const nextActive = formData.get("nextActive") === "true";

  const panel = nextActive
    ? await electricalPanelService.reactivate(panelId)
    : await electricalPanelService.deactivate(panelId);

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      entity: "ElectricalPanel",
      entityId: panel.id,
      action: nextActive ? "ACTIVATE" : "DEACTIVATE",
      metadata: { tag: panel.tag },
    },
  });

  revalidatePath("/electrical-panels");
  revalidatePath(`/electrical-panels/${panelId}`);
}
