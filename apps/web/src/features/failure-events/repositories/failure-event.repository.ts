import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

export const failureEventRepository = {
  create: (data: Prisma.FailureEventCreateInput) => prisma.failureEvent.create({ data }),

  findByEquipment: (equipmentId: string) =>
    prisma.failureEvent.findMany({
      where: { equipmentId },
      orderBy: { occurredAt: "desc" },
      include: { createdBy: true, workOrder: true },
    }),
};
