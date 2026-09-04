import { prisma } from "@/lib/db/client";
import type { ElectricalComponentType, Prisma } from "@prisma/client";

export const thermalConfigRepository = {
  findGlobal: () => prisma.thermalGlobalConfig.findUnique({ where: { id: "default" } }),

  findAllComponentTypeConfigs: () =>
    prisma.thermalComponentTypeConfig.findMany({ orderBy: { componentType: "asc" } }),

  findComponentTypeConfig: (componentType: ElectricalComponentType) =>
    prisma.thermalComponentTypeConfig.findUnique({ where: { componentType } }),

  upsertGlobal: (data: Prisma.ThermalGlobalConfigUncheckedCreateInput) =>
    prisma.thermalGlobalConfig.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...data },
    }),

  upsertComponentTypeConfig: (
    componentType: ElectricalComponentType,
    data: Omit<Prisma.ThermalComponentTypeConfigUncheckedCreateInput, "componentType">
  ) =>
    prisma.thermalComponentTypeConfig.upsert({
      where: { componentType },
      update: data,
      create: { componentType, ...data },
    }),
};
