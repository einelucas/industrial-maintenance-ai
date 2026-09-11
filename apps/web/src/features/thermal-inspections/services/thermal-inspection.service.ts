import type { CompanyThermalPriority } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export const SOURCE_PRIORITY_LABELS: Record<"P3" | "P4" | "P5", string> = {
  P3: "Prioridade 3",
  P4: "Prioridade 4",
  P5: "Prioridade 5",
};

export const thermalInspectionService = {
  // Todas as inspeções registradas, mais recente primeiro — não depende de
  // um registro único fixo; funciona com qualquer quantidade de inspeções
  // que o cliente tiver cadastrado.
  list() {
    return prisma.thermalInspection.findMany({
      orderBy: { inspectedAt: "desc" },
      include: { _count: { select: { findings: true } } },
    });
  },

  findingsForPoint(thermalPointId: string) {
    return prisma.thermalInspectionFinding.findMany({
      where: { thermalPointId },
      orderBy: { createdAt: "desc" },
      include: { inspection: true, thermalReading: true },
    });
  },

  // Distribuição de prioridade empresarial agregada sobre TODOS os achados
  // já registrados (qualquer inspeção), não filtrada por um sourceReference
  // fixo. Reflete o histórico real do cliente, seja qual for o volume.
  async distribution(): Promise<Record<CompanyThermalPriority, number>> {
    const rows = await prisma.thermalInspectionFinding.groupBy({
      by: ["companyPriority"],
      _count: { _all: true },
    });
    const distribution = { P5: 0, P10: 0, P20: 0, P30: 0, P50: 0, P100: 0 } as Record<CompanyThermalPriority, number>;
    for (const row of rows) distribution[row.companyPriority] = row._count._all;
    return distribution;
  },
};
