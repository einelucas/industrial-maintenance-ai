"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { maintenancePlanService } from "@/features/maintenance-plans/services/maintenance-plan.service";
import { requirePermission } from "@/lib/auth/session";

export async function generateWorkOrderFromPlanAction(formData: FormData) {
  const user = await requirePermission("plan:manage");
  const planId = formData.get("planId") as string;

  const workOrder = await maintenancePlanService.generateWorkOrder(planId, user.id);

  revalidatePath("/work-orders");
  revalidatePath("/maintenance-plans");
  redirect(`/work-orders/${workOrder.id}`);
}
