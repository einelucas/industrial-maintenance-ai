import { prisma } from "@/lib/db/client";
import type { SectorInput } from "@/features/sectors/schemas/sector.schema";

export const sectorRepository = {
  findAll: () => prisma.sector.findMany({ orderBy: { name: "asc" } }),

  findAllWithEquipmentCount: () =>
    prisma.sector.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { equipments: true } } },
    }),

  findById: (id: string) => prisma.sector.findUnique({ where: { id } }),

  create: (data: SectorInput) => prisma.sector.create({ data }),

  update: (id: string, data: SectorInput) => prisma.sector.update({ where: { id }, data }),
};
