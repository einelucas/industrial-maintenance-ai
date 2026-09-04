import { prisma } from "@/lib/db/client";
import type { Prisma, MonitoringMode } from "@prisma/client";

export interface ThermalPointFilters {
  search?: string;
  componentId?: string;
  panelId?: string;
  monitoringMode?: MonitoringMode;
  active?: boolean;
  skip?: number;
  take?: number;
}

export const thermalPointRepository = {
  // Lista completa (sem paginação) para popular <select> — só pontos ativos.
  findAllActive: () => prisma.thermalPoint.findMany({ where: { active: true }, orderBy: { code: "asc" } }),

  async findFiltered(filters: ThermalPointFilters) {
    const where: Prisma.ThermalPointWhereInput = {};
    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.componentId) where.componentId = filters.componentId;
    if (filters.panelId) where.component = { panelId: filters.panelId };
    if (filters.monitoringMode) where.monitoringMode = filters.monitoringMode;
    if (filters.active !== undefined) where.active = filters.active;

    const [items, total] = await Promise.all([
      prisma.thermalPoint.findMany({
        where,
        orderBy: { code: "asc" },
        include: {
          component: { include: { panel: true } },
          devices: { select: { id: true, status: true } },
          // Última Prediction válida — hoje sempre ausente (0 predições no
          // banco). A UI trata a ausência como "Aguardando análise da IA",
          // nunca como "normal".
          predictions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.thermalPoint.count({ where }),
    ]);

    return { items, total };
  },

  findByCode: (code: string) => prisma.thermalPoint.findUnique({ where: { code } }),

  // Usado pela ingestão em lote de leituras (CSV/simulador — Etapa 4): uma
  // única consulta para resolver todos os códigos de uma importação, em vez
  // de N consultas (uma por linha).
  findManyByCodes: (codes: string[]) => prisma.thermalPoint.findMany({ where: { code: { in: codes } } }),

  findById: (id: string) =>
    prisma.thermalPoint.findUnique({
      where: { id },
      include: {
        component: { include: { panel: { include: { sector: true } } } },
        devices: { orderBy: { createdAt: "asc" } },
        predictions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),

  countReadings: (thermalPointId: string) => prisma.thermalReading.count({ where: { thermalPointId } }),

  create: (data: Prisma.ThermalPointUncheckedCreateInput) => prisma.thermalPoint.create({ data }),

  update: (id: string, data: Prisma.ThermalPointUncheckedUpdateInput) =>
    prisma.thermalPoint.update({ where: { id }, data }),
};
