import { prisma } from "@/lib/db/client";
import type { Prisma, MonitoringMode, AnalysisStatus } from "@prisma/client";

export interface ThermalReadingFilters {
  thermalPointId?: string;
  source?: MonitoringMode;
  analysisStatus?: AnalysisStatus;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
}

// Insere em lotes pequenos (~500 linhas) em vez de um único `createMany`
// gigante — a mesma lição aprendida na Etapa 2 com a semeadura de 13.200
// leituras contra o pooler do Neon (erro P1017: a conexão fecha sob muitas
// linhas/round-trips numa única transação implícita longa).
const BATCH_CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export const thermalReadingRepository = {
  create: (data: Prisma.ThermalReadingUncheckedCreateInput) => prisma.thermalReading.create({ data }),

  /** Insere várias leituras já validadas/resolvidas. Devolve a contagem efetivamente inserida. */
  async createManyChunked(rows: Prisma.ThermalReadingUncheckedCreateInput[]): Promise<number> {
    let inserted = 0;
    for (const batch of chunk(rows, BATCH_CHUNK_SIZE)) {
      const result = await prisma.thermalReading.createMany({ data: batch });
      inserted += result.count;
    }
    return inserted;
  },

  async findFiltered(filters: ThermalReadingFilters) {
    const where: Prisma.ThermalReadingWhereInput = {};
    if (filters.thermalPointId) where.thermalPointId = filters.thermalPointId;
    if (filters.source) where.source = filters.source;
    if (filters.analysisStatus) where.analysisStatus = filters.analysisStatus;
    if (filters.from || filters.to) {
      where.measuredAt = {};
      if (filters.from) where.measuredAt.gte = filters.from;
      if (filters.to) where.measuredAt.lte = filters.to;
    }

    const [items, total] = await Promise.all([
      prisma.thermalReading.findMany({
        where,
        orderBy: { measuredAt: "desc" },
        include: { thermalPoint: { select: { code: true, name: true } } },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.thermalReading.count({ where }),
    ]);

    return { items, total };
  },

  findRecentForPoint: (thermalPointId: string, take: number) =>
    prisma.thermalReading.findMany({ where: { thermalPointId }, orderBy: { measuredAt: "desc" }, take }),

  /**
   * Histórico anterior a uma leitura, para cálculo de features temporais
   * (GPMS 2026 / Etapa 5). Sempre `measuredAt < beforeMeasuredAt` (nunca
   * inclui a própria leitura nem qualquer leitura futura) e limitado a um
   * teto de amostras para não carregar toda a série de um ponto de uma vez.
   */
  findHistoryBefore: (thermalPointId: string, beforeMeasuredAt: Date, take: number) =>
    prisma.thermalReading.findMany({
      where: { thermalPointId, measuredAt: { lt: beforeMeasuredAt } },
      orderBy: { measuredAt: "desc" },
      take,
    }),

  findFirstPendingForPoint: (thermalPointId: string) =>
    prisma.thermalReading.findFirst({
      where: { thermalPointId, analysisStatus: "PENDING_AI" },
      orderBy: { measuredAt: "asc" },
    }),

  countByAnalysisStatus: (analysisStatus: AnalysisStatus) => prisma.thermalReading.count({ where: { analysisStatus } }),
};
