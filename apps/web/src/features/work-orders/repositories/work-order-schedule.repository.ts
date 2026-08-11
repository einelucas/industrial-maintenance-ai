import { prisma } from "@/lib/db/client";
import type { Prisma, WorkOrderStatus, WorkOrderType } from "@prisma/client";

export interface ScheduleFilters {
  sectorId?: string;
  assignedUserId?: string;
  status?: WorkOrderStatus;
  type?: WorkOrderType;
  from?: Date;
  to?: Date;
}

export const workOrderScheduleRepository = {
  findFiltered: (filters: ScheduleFilters) => {
    const where: Prisma.WorkOrderWhereInput = {
      scheduledStart: { not: null },
      scheduledEnd: {
        not: null,
        ...(filters.from ? { gte: filters.from } : {}),
      },
    };

    if (filters.to) {
      // scheduledStart <= to (janela [from, to] intersecta a OS)
      where.scheduledStart = { not: null, lte: filters.to };
    }
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;
    if (filters.sectorId) where.equipment = { sectorId: filters.sectorId };

    return prisma.workOrder.findMany({
      where,
      include: { equipment: { include: { sector: true } }, assignedUser: true },
      orderBy: { scheduledStart: "asc" },
    });
  },
};
