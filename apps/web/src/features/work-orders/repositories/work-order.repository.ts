import { prisma } from "@/lib/db/client";
import type { Prisma, WorkOrderPriority, WorkOrderStatus, WorkOrderType } from "@prisma/client";

export interface WorkOrderFilters {
  search?: string;
  status?: WorkOrderStatus;
  type?: WorkOrderType;
  priority?: WorkOrderPriority;
  equipmentId?: string;
  skip?: number;
  take?: number;
}

export const workOrderRepository = {
  findAll: () =>
    prisma.workOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: { equipment: true, assignedUser: true, createdBy: true },
    }),

  findByEquipment: (equipmentId: string) =>
    prisma.workOrder.findMany({
      where: { equipmentId },
      orderBy: { createdAt: "desc" },
      include: { assignedUser: true },
    }),

  findById: (id: string) =>
    prisma.workOrder.findUnique({
      where: { id },
      include: {
        equipment: true,
        assignedUser: true,
        createdBy: true,
        history: { orderBy: { createdAt: "desc" }, include: { user: true } },
        checklistItems: { orderBy: { order: "asc" } },
      },
    }),

  create: (data: Prisma.WorkOrderCreateInput) => prisma.workOrder.create({ data }),

  updateStatus: (
    id: string,
    status: WorkOrderStatus,
    extra: Prisma.WorkOrderUpdateInput = {}
  ) => prisma.workOrder.update({ where: { id }, data: { status, ...extra } }),

  addHistory: (data: Prisma.WorkOrderHistoryCreateInput) => prisma.workOrderHistory.create({ data }),

  countByStatus: (status: WorkOrderStatus) => prisma.workOrder.count({ where: { status } }),

  countAll: () => prisma.workOrder.count(),

  findOpenWithSchedule: () =>
    prisma.workOrder.findMany({
      where: { status: { notIn: ["COMPLETED", "CANCELED"] } },
      include: { equipment: true, assignedUser: true },
    }),

  // Ordens criadas dentro do período — usado pelo relatório "Ordens por período".
  findByDateRange: (start: Date, end: Date) =>
    prisma.workOrder.findMany({
      where: { createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "desc" },
      include: { equipment: true, assignedUser: true, createdBy: true },
    }),

  // Busca/filtro (número ou título) + paginação — usado por /work-orders.
  async findFiltered(filters: WorkOrderFilters) {
    const where: Prisma.WorkOrderWhereInput = {};
    if (filters.search) {
      where.OR = [
        { number: { contains: filters.search, mode: "insensitive" } },
        { title: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.priority) where.priority = filters.priority;
    if (filters.equipmentId) where.equipmentId = filters.equipmentId;

    const [items, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { equipment: true, assignedUser: true, createdBy: true },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.workOrder.count({ where }),
    ]);

    return { items, total };
  },
};
