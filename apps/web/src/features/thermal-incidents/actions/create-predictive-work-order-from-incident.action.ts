"use server";

import { revalidatePath } from "next/cache";
import type { WorkOrderPriority } from "@prisma/client";
import { predictiveWorkOrderService } from "@/features/thermal-incidents/services/predictive-work-order.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type CreatePredictiveWorkOrderFormState = { error?: string; success?: boolean; workOrderId?: string };

// Ação dedicada de OS preditiva térmica (GPMS 2026 / Etapa 5) — reaproveita
// `incident:convert-to-work-order` (já existente desde a Etapa 1, concedida
// só a ADMIN/PLANNER, nunca TECHNICIAN). A interface que chama esta action
// é da Etapa 6; aqui só o backend fica pronto e testado.
export async function createPredictiveWorkOrderFromIncidentAction(
  _prevState: CreatePredictiveWorkOrderFormState,
  formData: FormData
): Promise<CreatePredictiveWorkOrderFormState> {
  try {
    const user = await requirePermission("incident:convert-to-work-order");

    const thermalIncidentId = String(formData.get("thermalIncidentId") ?? "");
    const title = formData.get("title");
    const priority = formData.get("priority");
    const assignedUserId = formData.get("assignedUserId");
    const notes = formData.get("notes");

    const workOrder = await predictiveWorkOrderService.createFromConfirmedIncident(
      {
        thermalIncidentId,
        title: title ? String(title) : undefined,
        priority: priority ? (String(priority) as WorkOrderPriority) : undefined,
        assignedUserId: assignedUserId ? String(assignedUserId) : undefined,
        notes: notes ? String(notes) : undefined,
      },
      user.id
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "WorkOrder",
        entityId: workOrder.id,
        action: "CREATE_PREDICTIVE_FROM_THERMAL_INCIDENT",
        metadata: { thermalIncidentId, sourcePredictionId: workOrder.sourcePredictionId },
      },
    });

    revalidatePath("/work-orders");
    revalidatePath(`/thermal-incidents/${thermalIncidentId}`);
    revalidatePath("/thermal-incidents");
    revalidatePath("/thermal-monitoring", "layout");
    return { success: true, workOrderId: workOrder.id };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
