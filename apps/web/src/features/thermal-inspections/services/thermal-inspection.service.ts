import type { CompanyThermalPriority } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { GPMS_EXPECTED_ORIGINAL_DISTRIBUTION } from "@/features/gpms-scope/constants";

export const ORIGINAL_INSPECTION_REFERENCE = "GPMS2026-ORIGINAL-INSPECTION-DEMO-MAPPING-V1";

export const SOURCE_PRIORITY_LABELS: Record<"P3" | "P4" | "P5", string> = {
  P3: "Prioridade 3",
  P4: "Prioridade 4",
  P5: "Prioridade 5",
};

export const EXPECTED_ORIGINAL_DISTRIBUTION: Record<CompanyThermalPriority, number> = {
  ...GPMS_EXPECTED_ORIGINAL_DISTRIBUTION,
};

export const thermalInspectionService = {
  getOriginal() {
    return prisma.thermalInspection.findUnique({
      where: { sourceReference: ORIGINAL_INSPECTION_REFERENCE },
      include: {
        findings: {
          orderBy: [{ companyPriority: "desc" }, { thermalPoint: { code: "asc" } }],
          include: { thermalPoint: { select: { id: true, code: true, name: true } }, thermalReading: true },
        },
      },
    });
  },

  findingsForPoint(thermalPointId: string) {
    return prisma.thermalInspectionFinding.findMany({
      where: { thermalPointId },
      orderBy: { createdAt: "desc" },
      include: { inspection: true, thermalReading: true },
    });
  },

  async originalDistribution(): Promise<Record<CompanyThermalPriority, number>> {
    const rows = await prisma.thermalInspectionFinding.groupBy({
      by: ["companyPriority"],
      where: { inspection: { sourceReference: ORIGINAL_INSPECTION_REFERENCE } },
      _count: { _all: true },
    });
    const distribution = { P5: 0, P10: 0, P20: 0, P30: 0, P50: 0, P100: 0 } as Record<CompanyThermalPriority, number>;
    for (const row of rows) distribution[row.companyPriority] = row._count._all;
    return distribution;
  },
};
