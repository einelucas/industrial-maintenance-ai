import { prisma } from "@/lib/db/client";
import type { Prisma, EquipmentCriticality, EquipmentStatus } from "@prisma/client";
import type { EquipmentInput } from "@/features/equipments/schemas/equipment.schema";

export interface EquipmentFilters {
  search?: string;
  status?: EquipmentStatus;
  criticality?: EquipmentCriticality;
  sectorId?: string;
  skip?: number;
  take?: number;
}

export const equipmentRepository = {
  findAll: () =>
    prisma.equipment.findMany({
      orderBy: { name: "asc" },
      include: { sector: true },
    }),

  // Busca/filtro (TAG ou nome) + paginação — usado por /equipments.
  async findFiltered(filters: EquipmentFilters) {
    const where: Prisma.EquipmentWhereInput = {};
    if (filters.search) {
      where.OR = [
        { tag: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.status) where.status = filters.status;
    if (filters.criticality) where.criticality = filters.criticality;
    if (filters.sectorId) where.sectorId = filters.sectorId;

    const [items, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        orderBy: { name: "asc" },
        include: { sector: true },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.equipment.count({ where }),
    ]);

    return { items, total };
  },

  findByTag: (tag: string) => prisma.equipment.findUnique({ where: { tag } }),

  findById: (id: string) =>
    prisma.equipment.findUnique({
      where: { id },
      include: { sector: true },
    }),

  create: (data: EquipmentInput) =>
    prisma.equipment.create({
      data: {
        ...data,
        installationDate: data.installationDate ? new Date(data.installationDate) : null,
      },
    }),

  update: (id: string, data: EquipmentInput) =>
    prisma.equipment.update({
      where: { id },
      data: {
        ...data,
        installationDate: data.installationDate ? new Date(data.installationDate) : null,
      },
    }),

  countAll: () => prisma.equipment.count(),

  countByStatus: (status: "OPERATIONAL" | "MAINTENANCE" | "STOPPED" | "INACTIVE") =>
    prisma.equipment.count({ where: { status } }),
};
