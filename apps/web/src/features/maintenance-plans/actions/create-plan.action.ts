"use server";

import { revalidatePath } from "next/cache";
import { maintenancePlanService } from "@/features/maintenance-plans/services/maintenance-plan.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";

export type PlanFormState = { error?: string; success?: boolean };

export async function createPlanAction(_prevState: PlanFormState, formData: FormData): Promise<PlanFormState> {
  try {
    await requirePermission("plan:manage");
    // Object.fromEntries() só mantém o último valor de campos repetidos —
    // checklistItems precisa ser coletado à parte via getAll().
    const raw = {
      ...Object.fromEntries(formData.entries()),
      checklistItems: formData.getAll("checklistItems").map(String).filter(Boolean),
    };
    await maintenancePlanService.create(raw);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/maintenance-plans");
  return { success: true };
}
