"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { alertService } from "@/features/alerts/services/alert.service";
import { requirePermission } from "@/lib/auth/session";

export async function acknowledgeAlertAction(formData: FormData) {
  const user = await requirePermission("alert:manage");
  const alertId = formData.get("alertId") as string;
  await alertService.acknowledge(alertId, user.id);
  revalidatePath("/alerts");
}

export async function convertAlertToWorkOrderAction(formData: FormData) {
  const user = await requirePermission("alert:manage");
  const alertId = formData.get("alertId") as string;
  const workOrder = await alertService.convertToWorkOrder(alertId, user.id);
  revalidatePath("/alerts");
  revalidatePath("/work-orders");
  redirect(`/work-orders/${workOrder.id}`);
}
