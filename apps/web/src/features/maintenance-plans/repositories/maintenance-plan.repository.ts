import { prisma } from "@/lib/db/client";
import type { FrequencyType, Prisma } from "@prisma/client";

export interface MaintenancePlanFilters {
  search?: string;
  frequencyType?: FrequencyType;
  skip?: number;
  take?: number;
}

export const maintenancePlanRepository = {
  findAll: () =>
    prisma.maintenancePlan.findMany({
      orderBy: { nextExecution: "asc" },
      include: { equipment: true, defaultAssignee: true, checklistItems: true },
    }),

  // Busca (nome do plano ou TAG do equipamento) + filtro de frequência +
  // paginação — usado por /maintenance-plans.
  async findFiltered(filters: MaintenancePlanFilters) {
    const where: Prisma.MaintenancePlanWhereInput = {};
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { equipment: { tag: { contains: filters.search, mode: "insensitive" } } },
      ];
    }
    if (filters.frequencyType) where.frequencyType = filters.frequencyType;

    const [items, total] = await Promise.all([
      prisma.maintenancePlan.findMany({
        where,
        orderBy: { nextExecution: "asc" },
        include: { equipment: true, defaultAssignee: true, checklistItems: true },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.maintenancePlan.count({ where }),
    ]);

    return { items, total };
  },

  findById: (id: string) =>
    prisma.maintenancePlan.findUnique({
      where: { id },
      include: { equipment: true, checklistItems: { orderBy: { order: "asc" } } },
    }),

  findByEquipment: (equipmentId: string) =>
    prisma.maintenancePlan.findMany({ where: { equipmentId }, orderBy: { nextExecution: "asc" } }),

  create: (data: Prisma.MaintenancePlanCreateInput) => prisma.maintenancePlan.create({ data }),

  update: (id: string, data: Prisma.MaintenancePlanUpdateInput) =>
    prisma.maintenancePlan.update({ where: { id }, data }),

  // Planos ativos vencidos, usados pelo scheduler automático de OS preventivas.
  findDue: (now: Date) =>
    prisma.maintenancePlan.findMany({
      where: { active: true, nextExecution: { lte: now } },
      include: { checklistItems: { orderBy: { order: "asc" } } },
    }),

  countActive: () => prisma.maintenancePlan.count({ where: { active: true } }),
};
