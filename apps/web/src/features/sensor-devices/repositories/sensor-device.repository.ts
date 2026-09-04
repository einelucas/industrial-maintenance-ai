import { prisma } from "@/lib/db/client";
import type { Prisma, DeviceStatus } from "@prisma/client";

export interface SensorDeviceFilters {
  thermalPointId?: string;
  status?: DeviceStatus;
  search?: string;
  skip?: number;
  take?: number;
}

// Nunca seleciona/retorna `apiKeyHash` fora de `create`/`revoke`/`reprovision`
// (que precisam gravá-lo, mas não o devolvem ao chamador). Listagens e
// detalhe usam `select` explícito sem esse campo.
const SAFE_SELECT = {
  id: true,
  serialNumber: true,
  name: true,
  manufacturer: true,
  model: true,
  firmwareVersion: true,
  status: true,
  thermalPointId: true,
  lastSeenAt: true,
  lastSequence: true,
  calibrationDate: true,
  installedAt: true,
  disabledAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SensorDeviceSelect;

export const sensorDeviceRepository = {
  async findFiltered(filters: SensorDeviceFilters) {
    const where: Prisma.SensorDeviceWhereInput = {};
    if (filters.thermalPointId) where.thermalPointId = filters.thermalPointId;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { serialNumber: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.sensorDevice.findMany({
        where,
        select: { ...SAFE_SELECT, thermalPoint: { select: { id: true, code: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.sensorDevice.count({ where }),
    ]);

    return { items, total };
  },

  findById: (id: string) =>
    prisma.sensorDevice.findUnique({
      where: { id },
      select: { ...SAFE_SELECT, thermalPoint: { select: { id: true, code: true, name: true } } },
    }),

  findBySerialNumber: (serialNumber: string) => prisma.sensorDevice.findUnique({ where: { serialNumber } }),

  create: (data: Prisma.SensorDeviceUncheckedCreateInput) =>
    prisma.sensorDevice.create({ data, select: SAFE_SELECT }),

  update: (id: string, data: Prisma.SensorDeviceUncheckedUpdateInput) =>
    prisma.sensorDevice.update({ where: { id }, data, select: SAFE_SELECT }),
};
