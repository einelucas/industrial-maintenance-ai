import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

export const predictionEvidenceInclude = {
  thermalReading: { select: { id: true, thermalPointId: true, measuredAt: true, source: true, analysisStatus: true } },
  inferenceRequest: { select: { inferenceRequestId: true, status: true, predictionId: true, thermalReadingId: true, thermalPointId: true, featureVersion: true } },
} satisfies Prisma.PredictionInclude;

export const traceablePredictionWhere = {
  inferenceId: { not: null }, modelChecksum: { not: null }, featureVersion: { not: null },
  modelStage: { in: ["SYNTHETIC_EXPERIMENTAL", "PLANT_CALIBRATION", "PLANT_VALIDATED"] },
  thermalReading: { isNot: null }, inferenceRequest: { is: { status: "SUCCEEDED" } },
} satisfies Prisma.PredictionWhereInput;

export const predictionOrder = [{ thermalReading: { measuredAt: "desc" } }, { createdAt: "desc" }, { id: "desc" }] satisfies Prisma.PredictionOrderByWithRelationInput[];

const readingSelect = {
  id: true, measuredAt: true, temperatureMaxC: true, referenceTemperatureC: true,
  deltaTC: true, currentA: true, loadPercent: true, source: true, analysisStatus: true,
} satisfies Prisma.ThermalReadingSelect;

export const thermalMonitoringRepository = {
  points: () => prisma.thermalPoint.findMany({
    where: { active: true }, orderBy: { code: "asc" },
    include: {
      component: { include: { panel: { include: { sector: true, equipment: { select: { id: true, name: true, tag: true } } } } } },
      devices: { select: { status: true, lastSeenAt: true } },
      readings: { orderBy: [{ measuredAt: "desc" }, { id: "desc" }], take: 1, select: readingSelect },
      predictions: { where: traceablePredictionWhere, orderBy: predictionOrder, take: 1, include: predictionEvidenceInclude },
      inspectionFindings: { orderBy: { createdAt: "desc" }, take: 1, include: { inspection: true } },
      // Mesmo critério de "aberto" usado em openIncidents(); só para saber
      // se o ponto tem um incidente em aberto, sem trazer o registro inteiro.
      incidents: { where: { status: { notIn: ["NORMALIZED", "HUMAN_REJECTED", "DISMISSED"] } }, select: { id: true }, take: 1 },
    },
  }),
  queue: () => prisma.thermalReading.groupBy({ by: ["analysisStatus"], _count: { _all: true }, where: { thermalPoint: { active: true } } }),
  openIncidents: () => prisma.thermalIncident.count({ where: {
    status: { notIn: ["NORMALIZED", "HUMAN_REJECTED", "DISMISSED"] },
    triggerPrediction: traceablePredictionWhere,
  } }),
  point: (id: string) => prisma.thermalPoint.findUnique({ where: { id }, include: {
    component: { include: { panel: { include: { sector: true, equipment: { select: { id: true, name: true, tag: true } } } } } },
    devices: { select: { id: true, name: true, serialNumber: true, status: true, lastSeenAt: true, calibrationDate: true, firmwareVersion: true } },
    readings: { orderBy: [{ measuredAt: "desc" }, { id: "desc" }], take: 240, select: readingSelect },
    predictions: { where: traceablePredictionWhere, orderBy: predictionOrder, take: 30, include: predictionEvidenceInclude },
    incidents: { orderBy: { openedAt: "desc" }, take: 30 },
    workOrders: { orderBy: { createdAt: "desc" }, take: 30, select: { id: true, number: true, status: true, title: true } },
    inspectionFindings: { orderBy: { createdAt: "desc" }, include: { inspection: true, thermalReading: true } },
    _count: { select: { readings: true } },
  } }),
  async queueMetrics(now = new Date()) {
    const since = new Date(now.getTime() - 60 * 60 * 1000);
    const [oldestPending, pendingRequests, orphanedReadings, leasedCount, telemetry, analyzedLastHour, failedRequests] = await Promise.all([
      prisma.inferenceRequest.findFirst({ where: { status: "PENDING" }, orderBy: { availableAt: "asc" }, select: { availableAt: true } }),
      prisma.inferenceRequest.count({ where: { status: "PENDING" } }),
      prisma.thermalReading.count({ where: { analysisStatus: "PENDING_AI", inferenceRequests: { none: {} } } }),
      prisma.inferenceRequest.count({ where: { status: "PENDING", leaseExpiresAt: { gt: now } } }),
      prisma.deviceTelemetryRequest.aggregate({ where: { createdAt: { gte: since } }, _sum: { itemCount: true, acceptedCount: true, duplicateCount: true, rejectedCount: true }, _count: { _all: true } }),
      prisma.inferenceRequest.count({ where: { status: "SUCCEEDED", completedAt: { gte: since } } }),
      prisma.inferenceRequest.count({ where: { status: "FAILED" } }),
    ]);
    return {
      oldestPendingAt: oldestPending?.availableAt ?? null,
      pendingRequests,
      orphanedReadings,
      leasedCount,
      receivedLastHour: telemetry._sum.itemCount ?? 0,
      persistedLastHour: telemetry._sum.acceptedCount ?? 0,
      duplicateLastHour: telemetry._sum.duplicateCount ?? 0,
      rejectedLastHour: telemetry._sum.rejectedCount ?? 0,
      telemetryRequestsLastHour: telemetry._count._all,
      analyzedLastHour,
      failedRequests,
    };
  },
};
