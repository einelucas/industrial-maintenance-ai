"use server";

import { revalidatePath } from "next/cache";
import { monitoredComponentService } from "@/features/monitored-components/services/monitored-component.service";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function toggleActiveMonitoredComponentAction(formData: FormData) {
  const actor = await requirePermission("panel:manage");

  const componentId = formData.get("componentId") as string;
  const nextActive = formData.get("nextActive") === "true";

  const component = nextActive
    ? await monitoredComponentService.reactivate(componentId)
    : await monitoredComponentService.deactivate(componentId);

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      entity: "MonitoredComponent",
      entityId: component.id,
      action: nextActive ? "ACTIVATE" : "DEACTIVATE",
      metadata: { tag: component.tag },
    },
  });

  revalidatePath("/monitored-components");
  revalidatePath(`/monitored-components/${componentId}`);
}
