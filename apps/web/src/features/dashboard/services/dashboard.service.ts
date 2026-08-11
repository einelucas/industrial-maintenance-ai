import { prisma } from "@/lib/db/client";
import { isWorkOrderDelayed } from "@/features/work-orders/services/work-order-delay.service";
import { startOfMonth, subMonths, format } from "date-fns";

export const dashboardService = {
  async getSummaryCards() {
    const [activeEquipments, openWO, inProgressWO, completedWO, openAlerts, allOpenWO, highRiskEquipments] =
      await Promise.all([
        prisma.equipment.count({ where: { status: "OPERATIONAL" } }),
        prisma.workOrder.count({ where: { status: "OPEN" } }),
        prisma.workOrder.count({ where: { status: "IN_PROGRESS" } }),
        prisma.workOrder.count({ where: { status: "COMPLETED" } }),
        prisma.alert.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
        prisma.workOrder.findMany({
          where: { status: { notIn: ["COMPLETED", "CANCELED"] } },
          select: { scheduledEnd: true, status: true },
        }),
        prisma.equipment.count({
          where: {
            predictions: {
              some: { riskLevel: { in: ["HIGH", "CRITICAL"] } },
            },
          },
        }),
      ]);

    const delayedWO = allOpenWO.filter((wo) => isWorkOrderDelayed(wo.scheduledEnd, wo.status)).length;

    return {
      activeEquipments,
      openWO,
      inProgressWO,
      delayedWO,
      completedWO,
      openAlerts,
      highRiskEquipments,
    };
  },

  async getWorkOrdersByStatus() {
    const grouped = await prisma.workOrder.groupBy({ by: ["status"], _count: true });
    return grouped.map((g) => ({ status: g.status, count: g._count }));
  },

  async getWorkOrdersByType() {
    const grouped = await prisma.workOrder.groupBy({ by: ["type"], _count: true });
    return grouped.map((g) => ({ type: g.type, count: g._count }));
  },

  async getMonthlyOpenVsCompleted() {
    const months = Array.from({ length: 6 }).map((_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
    const workOrders = await prisma.workOrder.findMany({
      select: { createdAt: true, actualEnd: true },
    });

    return months.map((monthStart) => {
      const monthLabel = format(monthStart, "MMM/yy");
      const nextMonth = new Date(monthStart);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const opened = workOrders.filter((wo) => wo.createdAt >= monthStart && wo.createdAt < nextMonth).length;
      const completed = workOrders.filter(
        (wo) => wo.actualEnd && wo.actualEnd >= monthStart && wo.actualEnd < nextMonth
      ).length;

      return { month: monthLabel, abertas: opened, concluidas: completed };
    });
  },

  async getTopEquipmentsByInterventions() {
    const grouped = await prisma.workOrder.groupBy({
      by: ["equipmentId"],
      _count: true,
      orderBy: { _count: { equipmentId: "desc" } },
      take: 5,
    });

    const equipmentIds = grouped.map((g) => g.equipmentId);
    const equipments = await prisma.equipment.findMany({ where: { id: { in: equipmentIds } } });
    const equipmentMap = new Map(equipments.map((e) => [e.id, e]));

    return grouped.map((g) => ({
      tag: equipmentMap.get(g.equipmentId)?.tag ?? g.equipmentId,
      count: g._count,
    }));
  },

  async getRiskDistribution() {
    // Última predição por equipamento, agrupada por riskLevel.
    const equipments = await prisma.equipment.findMany({
      select: { id: true, predictions: { orderBy: { createdAt: "desc" }, take: 1, select: { riskLevel: true } } },
    });

    const counts: Record<string, number> = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
    for (const eq of equipments) {
      const level = eq.predictions[0]?.riskLevel;
      if (level) counts[level] = (counts[level] ?? 0) + 1;
    }
    return Object.entries(counts).map(([level, count]) => ({ level, count }));
  },

  async getRiskEvolution() {
    const predictions = await prisma.prediction.findMany({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, failureProbability: true },
      take: 200,
    });

    // Agrupa por dia, calculando probabilidade média.
    const byDay = new Map<string, { sum: number; count: number }>();
    for (const p of predictions) {
      const key = format(p.createdAt, "dd/MM");
      const current = byDay.get(key) ?? { sum: 0, count: 0 };
      current.sum += p.failureProbability;
      current.count += 1;
      byDay.set(key, current);
    }

    return Array.from(byDay.entries()).map(([day, { sum, count }]) => ({
      day,
      probabilidadeMedia: Math.round((sum / count) * 1000) / 1000,
    }));
  },
};
