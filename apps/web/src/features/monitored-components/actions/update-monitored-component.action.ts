"use server";

import { revalidatePath } from "next/cache";
import { monitoredComponentService } from "@/features/monitored-components/services/monitored-component.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";
import type { MonitoredComponentFormState } from "@/features/monitored-components/actions/create-monitored-component.action";

export async function updateMonitoredComponentAction(
  id: string,
  _prevState: MonitoredComponentFormState,
  formData: FormData
): Promise<MonitoredComponentFormState> {
  try {
    const user = await requirePermission("panel:manage");

    const raw = Object.fromEntries(formData.entries());
    const component = await monitoredComponentService.update(id, raw);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "MonitoredComponent",
        entityId: component.id,
        action: "UPDATE",
        metadata: { tag: component.tag, panelId: component.panelId },
      },
    });

    revalidatePath("/monitored-components");
    revalidatePath(`/monitored-components/${id}`);
    revalidatePath(`/electrical-panels/${component.panelId}`);
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
