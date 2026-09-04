"use server";

import { revalidatePath } from "next/cache";
import { monitoredComponentService } from "@/features/monitored-components/services/monitored-component.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type MonitoredComponentFormState = { error?: string; success?: boolean };

export async function createMonitoredComponentAction(
  _prevState: MonitoredComponentFormState,
  formData: FormData
): Promise<MonitoredComponentFormState> {
  try {
    const user = await requirePermission("panel:manage");

    const raw = Object.fromEntries(formData.entries());
    const component = await monitoredComponentService.create(raw);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "MonitoredComponent",
        entityId: component.id,
        action: "CREATE",
        metadata: { tag: component.tag, panelId: component.panelId, componentType: component.componentType },
      },
    });

    revalidatePath("/monitored-components");
    revalidatePath(`/electrical-panels/${component.panelId}`);
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
