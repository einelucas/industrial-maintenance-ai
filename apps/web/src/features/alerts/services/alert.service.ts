import { prisma } from "@/lib/db/client";
import { alertRepository, type AlertFilters } from "@/features/alerts/repositories/alert.repository";
import { generateWorkOrderNumber } from "@/features/work-orders/services/work-order-number.service";
import { NotFoundError } from "@/lib/errors";

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
          equipment: { connect: { id: alert.equipmentId } },
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
