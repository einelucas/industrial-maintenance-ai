import { prisma } from "@/lib/db/client";

export const thermalIncidentRepository = {
  findById: (id: string) =>
    prisma.thermalIncident.findUnique({
      where: { id },
      include: {
        thermalPoint: { include: { component: { include: { panel: true } } } },
        triggerPrediction: true,
        alert: true,
      },
    }),

  findManyForPoint: (thermalPointId: string) =>
    prisma.thermalIncident.findMany({ where: { thermalPointId }, orderBy: { openedAt: "desc" } }),
};
