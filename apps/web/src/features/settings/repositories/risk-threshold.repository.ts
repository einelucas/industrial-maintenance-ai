import { prisma } from "@/lib/db/client";

const DEFAULT = { id: "default", lowMax: 0.3, moderateMax: 0.6, highMax: 0.8 };

export const riskThresholdRepository = {
  async getOrCreateDefault() {
    return prisma.riskThresholdConfig.upsert({
      where: { id: "default" },
      update: {},
      create: DEFAULT,
    });
  },

  update: (data: { lowMax: number; moderateMax: number; highMax: number }, updatedById: string) =>
    prisma.riskThresholdConfig.upsert({
      where: { id: "default" },
      update: { ...data, updatedById },
      create: { id: "default", ...data, updatedById },
    }),
};
