"use server";

import { revalidatePath } from "next/cache";
import { maintenancePlanService } from "@/features/maintenance-plans/services/maintenance-plan.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";

export type PlanFormState = { error?: string; success?: boolean };

export async function updatePlanAction(
  id: string,
  _prevState: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  try {
    await requirePermission("plan:manage");
    const raw = {
      ...Object.fromEntries(formData.entries()),
      checklistItems: formData.getAll("checklistItems").map(String).filter(Boolean),
    };
    await maintenancePlanService.update(id, raw);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/maintenance-plans");
  revalidatePath(`/maintenance-plans/${id}`);
  return { success: true };
}
