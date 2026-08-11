import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { SensorReadingCsvRow } from "@/features/sensor-readings/schemas/sensor-reading-csv-row.schema";

export const sensorReadingRepository = {
  create: (data: Prisma.SensorReadingCreateInput) => prisma.sensorReading.create({ data }),

  createManyForEquipment: (equipmentId: string, rows: SensorReadingCsvRow[]) =>
    prisma.sensorReading.createMany({
      data: rows.map((row) => ({ ...row, equipmentId, source: "CSV" as const })),
    }),

  findByEquipment: (equipmentId: string, take = 20) =>
    prisma.sensorReading.findMany({
      where: { equipmentId },
      orderBy: { measuredAt: "desc" },
      take,
    }),

  findLatestByEquipment: (equipmentId: string) =>
    prisma.sensorReading.findFirst({ where: { equipmentId }, orderBy: { measuredAt: "desc" } }),
};
