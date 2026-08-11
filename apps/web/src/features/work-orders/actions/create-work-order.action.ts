"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { workOrderService } from "@/features/work-orders/services/work-order.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";

export type WorkOrderFormState = { error?: string };

export async function createWorkOrderAction(
  _prevState: WorkOrderFormState,
  formData: FormData
): Promise<WorkOrderFormState> {
  let createdId: string | undefined;
  try {
    const user = await requirePermission("workorder:manage");
    const raw = Object.fromEntries(formData.entries());
    const workOrder = await workOrderService.create(raw, user.id);
    createdId = workOrder.id;
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }

  revalidatePath("/work-orders");
  redirect(`/work-orders/${createdId}`);
}
