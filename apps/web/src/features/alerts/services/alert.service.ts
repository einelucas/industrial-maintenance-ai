import { prisma } from "@/lib/db/client";
import type { WorkOrder } from "@prisma/client";
import { alertRepository, type AlertFilters } from "@/features/alerts/repositories/alert.repository";
import { ValidationError } from "@/lib/errors";

export const alertService = {
  listOpen: () => alertRepository.findOpen(),
  listFiltered: (filters: AlertFilters) => alertRepository.findFiltered(filters),
  async acknowledge(alertId: string, userId: string) {
    return prisma.alert.update({
      where: { id: alertId },
      data: { status: "ACKNOWLEDGED", acknowledgedById: userId, acknowledgedAt: new Date() },
    });
  },
  // Etapa 6: impedir bypass da evidência térmica e da confirmação humana,
  // inclusive por clientes antigos que ainda conhecem a Server Action.
  async convertToWorkOrder(_alertId: string, _userId: string): Promise<WorkOrder> {
    throw new ValidationError("Conversão legada desativada. Revise o incidente térmico e autorize a OS pelo fluxo de confirmação humana.");
  },
};
