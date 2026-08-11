"use server";

import { revalidatePath } from "next/cache";
import { failureEventService } from "@/features/failure-events/services/failure-event.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";

export type FailureEventFormState = { error?: string; success?: boolean };

export async function registerFailureEventAction(
  _prevState: FailureEventFormState,
  formData: FormData
): Promise<FailureEventFormState> {
  try {
    const user = await requirePermission("equipment:manage");
    const raw = Object.fromEntries(formData.entries());
    await failureEventService.register(raw, user.id);
    revalidatePath(`/equipments/${raw.equipmentId}`);
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  return { success: true };
}
