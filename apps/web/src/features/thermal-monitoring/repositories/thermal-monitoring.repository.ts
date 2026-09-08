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
    _count: { select: { readings: true } },
  } }),
};
