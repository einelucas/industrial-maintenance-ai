import { prisma } from "@/lib/db/client";
import type { WorkOrderPriority } from "@prisma/client";
import { generateWorkOrderNumber } from "@/features/work-orders/services/work-order-number.service";
import { resolveEquipmentIdFromPoint } from "@/features/ai-core/services/resolve-equipment-for-point";
import { aiCoreStateService } from "@/features/ai-core/services/ai-core-state.service";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { predictionEvidenceInclude } from "@/features/thermal-monitoring/repositories/thermal-monitoring.repository";
import { isTraceablePrediction } from "@/features/thermal-monitoring/services/thermal-presentation";

// Fluxo DEDICADO de OS preditiva térmica (GPMS 2026 / Etapa 5) — completamente
// separado de `alertService.convertToWorkOrder()` (fluxo mecânico legado,
// preservado sem alteração desde a Etapa 3) e do formulário genérico de OS
// (que continua sem a opção PREDICTIVE). É o ÚNICO caminho que pode criar
// `WorkOrder.type = "PREDICTIVE"` a partir de um `ThermalIncident`.
export interface CreatePredictiveWorkOrderInput {
  thermalIncidentId: string;
  title?: string;
  priority?: WorkOrderPriority;
  assignedUserId?: string;
  scheduledStart?: Date;
  notes?: string;
}

export const predictiveWorkOrderService = {
  async createFromConfirmedIncident(input: CreatePredictiveWorkOrderInput, createdById: string) {
    const incident = await prisma.thermalIncident.findUnique({
      where: { id: input.thermalIncidentId },
      include: {
        thermalPoint: { include: { component: { include: { panel: true } } } },
        triggerPrediction: { include: predictionEvidenceInclude },
      },
    });
    if (!incident) throw new NotFoundError("Incidente térmico", input.thermalIncidentId);

    // Pré-condições obrigatórias (seção 11 do prompt da Etapa 5) — cada uma
    // com uma mensagem específica, nunca um erro genérico "não autorizado".
    if (incident.humanReviewDecision !== "CONFIRMED" || incident.status !== "HUMAN_CONFIRMED") {
      throw new ValidationError("Só é possível criar OS preditiva para um incidente confirmado por revisão humana (HUMAN_CONFIRMED).");
    }
    if (incident.workOrderId) {
      throw new ConflictError("Este incidente já possui uma ordem de serviço vinculada.");
    }
    if (!incident.triggerPrediction || !isTraceablePrediction(incident.triggerPrediction)) {
      throw new ValidationError("Incidente sem Prediction de origem — não é possível criar OS preditiva.");
    }

    const aiState = await aiCoreStateService.getState();
    if (aiState.status !== "READY") {
      throw new ValidationError("Núcleo de IA térmica indisponível — criação de OS preditiva bloqueada até a IA voltar a ficar pronta.");
    }

    // Correspondência ponto -> painel -> equipamento -> OS: nunca fabricamos
    // um Equipment falso. Pontos ligados só a um painel de setor (sem
    // Equipment real) ainda não podem gerar OS preditiva — limitação
    // documentada, não contornada aqui.
    const equipmentId = resolveEquipmentIdFromPoint(incident.thermalPoint);
    if (!equipmentId) {
      throw new ValidationError(
        "O painel deste ponto termográfico não está vinculado a um equipamento real — criação de OS preditiva ainda não é suportada para pontos ligados só a um setor."
      );
    }

    const prediction = incident.triggerPrediction;
    const number = await generateWorkOrderNumber();

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${incident.thermalPointId}))`;
      // A confirmação pode ter sido revogada desde o carregamento da tela.
      // A reserva condicional também impede duas OS para o mesmo incidente.
      const reserved = await tx.thermalIncident.updateMany({
        where: { id: incident.id, status: "HUMAN_CONFIRMED", humanReviewDecision: "CONFIRMED", workOrderId: null, updatedAt: incident.updatedAt },
        data: { status: "WORK_ORDER_CREATED" },
      });
      if (reserved.count !== 1) throw new ConflictError("O incidente foi atualizado ou já possui uma OS. Recarregue a página.");
      const workOrder = await tx.workOrder.create({
        data: {
          number,
          title: input.title?.trim() || `Predição térmica confirmada — ${incident.thermalPoint.code}`,
          description: prediction.recommendedAction,
          type: "PREDICTIVE",
          priority: input.priority ?? (incident.severity === "CRITICAL" ? "CRITICAL" : "HIGH"),
          status: "OPEN",
          notes: input.notes,
          scheduledStart: input.scheduledStart,
          equipment: { connect: { id: equipmentId } },
          createdBy: { connect: { id: createdById } },
          sourcePrediction: { connect: { id: prediction.id } },
          thermalPoint: { connect: { id: incident.thermalPointId } },
          ...(input.assignedUserId ? { assignedUser: { connect: { id: input.assignedUserId } } } : {}),
        },
      });

      await tx.thermalIncident.update({
        where: { id: incident.id },
        data: { status: "WORK_ORDER_CREATED", workOrderId: workOrder.id },
      });

      await tx.workOrderHistory.create({
        data: {
          workOrderId: workOrder.id,
          userId: createdById,
          action: "CREATED",
          newStatus: "OPEN",
          description: `OS preditiva criada a partir do incidente térmico confirmado ${incident.id} (ponto ${incident.thermalPoint.code}).`,
        },
      });

      return workOrder;
    });
  },
};
