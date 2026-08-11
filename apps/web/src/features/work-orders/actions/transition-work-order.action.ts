"use server";

import { revalidatePath } from "next/cache";
import { workOrderService } from "@/features/work-orders/services/work-order.service";
import { requireUser } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";

export type TransitionState = { error?: string };

export async function transitionWorkOrderAction(
  _prevState: TransitionState,
  formData: FormData
): Promise<TransitionState> {
  try {
    const user = await requireUser();
    const workOrderId = formData.get("workOrderId") as string;
    const newStatus = formData.get("newStatus") as string;
    // formData.get() devolve `null` (não `undefined`) quando o campo não
    // existe — o cast `as string | undefined` só engana o TypeScript; em
    // runtime o Zod (`z.string().optional()`) rejeita `null`, o que fazia
    // TODA transição falhar com "Transição de status inválida" sempre que
    // o form não tinha um campo "notes" (nunca tem).
    const notes = (formData.get("notes") as string | null) ?? undefined;

    await workOrderService.transitionStatus({ workOrderId, newStatus, notes }, user);

    revalidatePath(`/work-orders/${workOrderId}`);
    revalidatePath("/work-orders");
    return {};
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
