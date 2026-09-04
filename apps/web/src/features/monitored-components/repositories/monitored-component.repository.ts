import { prisma } from "@/lib/db/client";
import type { Prisma, ElectricalComponentType } from "@prisma/client";

export interface MonitoredComponentFilters {
  search?: string;
  componentType?: ElectricalComponentType;
  panelId?: string;
  active?: boolean;
  skip?: number;
  take?: number;
}

export const monitoredComponentRepository = {
  // Lista completa (sem paginação) para popular <select> — só componentes ativos.
  findAllActive: () => prisma.monitoredComponent.findMany({ where: { active: true }, orderBy: { tag: "asc" } }),

  async findFiltered(filters: MonitoredComponentFilters) {
    const where: Prisma.MonitoredComponentWhereInput = {};
    if (filters.search) {
      where.OR = [
        { tag: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.componentType) where.componentType = filters.componentType;
    if (filters.panelId) where.panelId = filters.panelId;
    if (filters.active !== undefined) where.active = filters.active;

    const [items, total] = await Promise.all([
      prisma.monitoredComponent.findMany({
        where,
        orderBy: { tag: "asc" },
        include: { panel: true, _count: { select: { thermalPoints: true } } },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.monitoredComponent.count({ where }),
    ]);

    return { items, total };
  },

  findByTag: (tag: string) => prisma.monitoredComponent.findUnique({ where: { tag } }),

  findById: (id: string) =>
    prisma.monitoredComponent.findUnique({
      where: { id },
      include: {
        panel: { include: { sector: true } },
        thermalPoints: { orderBy: { code: "asc" } },
      },
    }),

  create: (data: Prisma.MonitoredComponentUncheckedCreateInput) => prisma.monitoredComponent.create({ data }),

  update: (id: string, data: Prisma.MonitoredComponentUncheckedUpdateInput) =>
    prisma.monitoredComponent.update({ where: { id }, data }),

  countActivePoints: (componentId: string) =>
    prisma.thermalPoint.count({ where: { componentId, active: true } }),
};
