import { prisma } from "@/lib/db/client";
import type { Prisma, RiskLevel } from "@prisma/client";

export const predictionRepository = {
  create: (data: Prisma.PredictionCreateInput) => prisma.prediction.create({ data }),

  // Predições no período — usado pelo relatório preditivo.
  findByPeriod: (start: Date, end: Date, riskLevel?: RiskLevel) =>
    prisma.prediction.findMany({
      where: { createdAt: { gte: start, lte: end }, ...(riskLevel ? { riskLevel } : {}) },
      orderBy: { createdAt: "desc" },
      include: { equipment: true },
    }),

  findByEquipment: (equipmentId: string, take = 20) =>
    prisma.prediction.findMany({
      where: { equipmentId },
      orderBy: { createdAt: "desc" },
      take,
    }),

  findLatestByEquipment: (equipmentId: string) =>
    prisma.prediction.findFirst({ where: { equipmentId }, orderBy: { createdAt: "desc" } }),
};
