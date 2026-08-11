import { prisma } from "@/lib/db/client";
import type { AlertSeverity, AlertStatus, Prisma } from "@prisma/client";

export interface AlertFilters {
  status?: AlertStatus;
  severity?: AlertSeverity;
  skip?: number;
  take?: number;
}

export const alertRepository = {
  findOpen: () =>
    prisma.alert.findMany({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      orderBy: { createdAt: "desc" },
      include: { equipment: { include: { sector: true } }, prediction: true },
    }),

  findById: (id: string) =>
    prisma.alert.findUnique({
      where: { id },
      include: { equipment: true, prediction: true },
    }),

  countByStatus: (status: AlertStatus) => prisma.alert.count({ where: { status } }),

  // Filtro + paginação — usado por /alerts. Sem `status` informado, preserva
  // o comportamento padrão da tela (só alertas OPEN/ACKNOWLEDGED).
  async findFiltered(filters: AlertFilters) {
    const where: Prisma.AlertWhereInput = filters.status
      ? { status: filters.status }
      : { status: { in: ["OPEN", "ACKNOWLEDGED"] } };
    if (filters.severity) where.severity = filters.severity;

    const [items, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { equipment: { include: { sector: true } }, prediction: true },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.alert.count({ where }),
    ]);

    return { items, total };
  },
};
