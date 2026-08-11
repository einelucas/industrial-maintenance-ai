"use server";

import { revalidatePath } from "next/cache";
import { maintenancePlanService } from "@/features/maintenance-plans/services/maintenance-plan.service";
import { requirePermission } from "@/lib/auth/session";

// Dispara manualmente a mesma rotina do cron (/api/cron/generate-preventive-work-orders) —
// útil para testar sem esperar o agendamento diário.
export async function runSchedulerAction() {
  await requirePermission("plan:manage");
  await maintenancePlanService.runScheduledGeneration();
  revalidatePath("/maintenance-plans");
  revalidatePath("/work-orders");
}
