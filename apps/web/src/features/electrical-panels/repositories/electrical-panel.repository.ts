import { prisma } from "@/lib/db/client";
import type { Prisma, PanelType } from "@prisma/client";

export interface ElectricalPanelFilters {
  search?: string;
  panelType?: PanelType;
  sectorId?: string;
  active?: boolean;
  skip?: number;
  take?: number;
}

// Acesso ao Prisma para ElectricalPanel — sem regra de autorização e sem
// criar resultado analítico (nunca toca em Prediction/Incident/Alert).
export const electricalPanelRepository = {
  // Lista completa (sem paginação) para popular <select> — só painéis ativos.
  findAllActive: () => prisma.electricalPanel.findMany({ where: { active: true }, orderBy: { tag: "asc" } }),

  async findFiltered(filters: ElectricalPanelFilters) {
    const where: Prisma.ElectricalPanelWhereInput = {};
    if (filters.search) {
      where.OR = [
        { tag: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.panelType) where.panelType = filters.panelType;
    if (filters.sectorId) where.sectorId = filters.sectorId;
    if (filters.active !== undefined) where.active = filters.active;

    const [items, total] = await Promise.all([
      prisma.electricalPanel.findMany({
        where,
        orderBy: { tag: "asc" },
        include: { sector: true, equipment: true, _count: { select: { components: true } } },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.electricalPanel.count({ where }),
    ]);

    return { items, total };
  },

  findByTag: (tag: string) => prisma.electricalPanel.findUnique({ where: { tag } }),

  findById: (id: string) =>
    prisma.electricalPanel.findUnique({
      where: { id },
      include: {
        sector: true,
        equipment: true,
        components: { orderBy: { tag: "asc" }, include: { _count: { select: { thermalPoints: true } } } },
      },
    }),

  create: (data: Prisma.ElectricalPanelUncheckedCreateInput) => prisma.electricalPanel.create({ data }),

  update: (id: string, data: Prisma.ElectricalPanelUncheckedUpdateInput) =>
    prisma.electricalPanel.update({ where: { id }, data }),

  countActiveComponents: (panelId: string) =>
    prisma.monitoredComponent.count({ where: { panelId, active: true } }),
};
