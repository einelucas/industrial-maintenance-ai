import { prisma } from "@/lib/db/client";
import { alertRepository, type AlertFilters } from "@/features/alerts/repositories/alert.repository";
import { generateWorkOrderNumber } from "@/features/work-orders/services/work-order-number.service";
import { NotFoundError, ValidationError } from "@/lib/errors";

export const alertService = {
  listOpen: () => alertRepository.findOpen(),

  listFiltered: (filters: AlertFilters) => alertRepository.findFiltered(filters),

  async acknowledge(alertId: string, userId: string) {
    return prisma.alert.update({
      where: { id: alertId },
      data: { status: "ACKNOWLEDGED", acknowledgedById: userId, acknowledgedAt: new Date() },
    });
  },

  /**
   * "Criar OS preditiva" a partir de um alerta (seção 22): sempre exige
   * intervenção humana do planejador. Vincula sourcePredictionId à OS e
   * marca o Alert como RESOLVED.
   */
  async convertToWorkOrder(alertId: string, userId: string) {
    const alert = await alertRepository.findById(alertId);
    if (!alert) throw new NotFoundError("Alerta", alertId);
    // `equipmentId` é anulável desde a Etapa 5 (alerta térmico consolidado
    // pode vir de um ponto sem Equipment real) — mas este fluxo é só o
    // mecânico legado, que sempre grava `equipmentId`. Guarda explícita em
    // vez de assumir: falha claro aqui em vez de um erro obscuro do Prisma
    // se algum dia um alerta térmico chegar por engano neste caminho (o
    // caminho térmico correto é `predictiveWorkOrderService`, não este).
    if (!alert.equipmentId) {
      throw new ValidationError("Este alerta não está vinculado a um equipamento — não é possível converter em OS por este fluxo.");
    }
    const equipmentId = alert.equipmentId;

    const number = await generateWorkOrderNumber();

    const workOrder = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          number,
          title: `Predição: ${alert.title}`,
          description: alert.description,
          type: "PREDICTIVE",
          priority: alert.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
          status: "OPEN",
          equipment: { connect: { id: equipmentId } },
          createdBy: { connect: { id: userId } },
          sourcePrediction: { connect: { id: alert.predictionId } },
        },
      });

      await tx.workOrderHistory.create({
        data: {
          workOrderId: wo.id,
          userId,
          action: "CREATED",
          newStatus: "OPEN",
          description: `OS preditiva gerada a partir do alerta ${alert.id}.`,
        },
      });

      await tx.alert.update({
        where: { id: alertId },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });

      return wo;
    });

    return workOrder;
  },
};
