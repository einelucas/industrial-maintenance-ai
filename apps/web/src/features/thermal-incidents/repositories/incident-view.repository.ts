import { prisma } from "@/lib/db/client";
import { predictionEvidenceInclude, predictionOrder, traceablePredictionWhere } from "@/features/thermal-monitoring/repositories/thermal-monitoring.repository";
import type { Prisma } from "@prisma/client";

export const incidentViewRepository = {
  async list(where: Prisma.ThermalIncidentWhereInput, skip: number, take: number) {
    const [items, total] = await Promise.all([
      prisma.thermalIncident.findMany({ where, skip, take, orderBy: [{ severity: "desc" }, { openedAt: "desc" }], include: {
        thermalPoint: { include: { component: { include: { panel: { include: { sector: true } } } } } },
        triggerPrediction: { include: predictionEvidenceInclude },
      } }),
      prisma.thermalIncident.count({ where }),
    ]);
    return { items, total };
  },
  detail: (id: string) => prisma.thermalIncident.findUnique({ where: { id }, include: {
    thermalPoint: { include: {
      component: { include: { panel: true } },
      predictions: { where: traceablePredictionWhere, orderBy: predictionOrder, take: 1, include: predictionEvidenceInclude },
    } },
    triggerPrediction: { include: predictionEvidenceInclude },
    humanReviews: { orderBy: { createdAt: "asc" }, include: { reviewedBy: { select: { name: true } } } },
    workOrder: { include: { history: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } } } },
    alert: true,
  } }),
  readingsSince: (thermalPointId: string, from: Date) => prisma.thermalReading.findMany({
    where: { thermalPointId, measuredAt: { gte: from } }, orderBy: { measuredAt: "desc" }, take: 240,
    select: { id: true, measuredAt: true, temperatureMaxC: true, referenceTemperatureC: true, deltaTC: true, currentA: true, loadPercent: true, source: true },
  }),
};
