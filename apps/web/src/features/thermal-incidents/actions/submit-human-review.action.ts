"use server";

import { revalidatePath } from "next/cache";
import { humanReviewService } from "@/features/thermal-incidents/services/human-review.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type SubmitHumanReviewFormState = { error?: string; success?: boolean };

// Backend da revisão humana (GPMS 2026 / Etapa 5) — a interface completa
// (botões "Confirmar defeito"/"Rejeitar"/"Inconclusivo"/"Nova leitura") é da
// Etapa 6. Reaproveita `incident:diagnose` (já existente desde a Etapa 1,
// concedida a ADMIN/PLANNER/TECHNICIAN) — é a mesma permissão que já
// significava "julgamento profissional sobre o incidente".
export async function submitHumanReviewAction(
  _prevState: SubmitHumanReviewFormState,
  formData: FormData
): Promise<SubmitHumanReviewFormState> {
  try {
    const user = await requirePermission("incident:diagnose");

    const raw = Object.fromEntries(formData.entries());
    const incident = await humanReviewService.submit(raw, user.id);

    // O histórico completo (decisão, justificativa, estado anterior/novo,
    // predição revisada) já fica em `HumanReview`, criado pelo service dentro
    // da mesma transação — aqui só registramos o ponteiro para essa decisão.
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "ThermalIncident",
        entityId: incident.id,
        action: "HUMAN_REVIEW",
        metadata: { decision: incident.humanReviewDecision, nextStatus: incident.status },
      },
    });

    revalidatePath(`/thermal-incidents/${incident.id}`);
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
