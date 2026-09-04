import { prisma } from "@/lib/db/client";
import type { Prisma, RiskLevel } from "@prisma/client";

export const predictionRepository = {
  create: (data: Prisma.PredictionCreateInput) => prisma.prediction.create({ data }),

  // Predições no período — usado pelo relatório preditivo.
  // Escopado ao fluxo preditivo mecânico (relatório em PDF por equipamento —
  // GPMS 2026 / Etapa 5: `equipmentId` virou anulável para acomodar
  // predições térmicas sem Equipment real, então esta consulta exclui
  // explicitamente predições térmicas em vez de arriscar `equipment: null`
  // num relatório que é inteiramente organizado por equipamento).
  async findByPeriod(start: Date, end: Date, riskLevel?: RiskLevel) {
    const rows = await prisma.prediction.findMany({
      where: { createdAt: { gte: start, lte: end }, thermalPointId: null, ...(riskLevel ? { riskLevel } : {}) },
      orderBy: { createdAt: "desc" },
      include: { equipment: true },
    });
    // `thermalPointId: null` acima garante, na prática, que só predições
    // mecânicas (sempre com equipmentId preenchido) entram aqui — o `!` só
    // reflete essa garantia para o tipo, não contorna nenhuma validação.
    return rows.map((r) => ({ ...r, equipment: r.equipment! }));
  },

  findByEquipment: (equipmentId: string, take = 20) =>
    prisma.prediction.findMany({
      where: { equipmentId },
      orderBy: { createdAt: "desc" },
      take,
    }),

  findLatestByEquipment: (equipmentId: string) =>
    prisma.prediction.findFirst({ where: { equipmentId }, orderBy: { createdAt: "desc" } }),
};
