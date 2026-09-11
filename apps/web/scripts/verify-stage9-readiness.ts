import { PrismaClient, type CompanyThermalPriority } from "@prisma/client";
import { DEMO_PRIORITY_POLICY_VERSION } from "../src/features/thermal-priority/constants";

const prisma = new PrismaClient();

// Identificadores do cenário demonstrativo determinístico — legado interno
// de diagnóstico (script dev-only), espelham os mesmos valores usados por
// seed-thermal-scenario.ts. Nunca expostos na UI da aplicação.
const LEGACY_DEMO_INSPECTION_REFERENCE = "GPMS2026-ORIGINAL-INSPECTION-DEMO-MAPPING-V1";
const LEGACY_DEMO_EXPECTED_DISTRIBUTION: Record<string, number> = {
  P5: 7,
  P10: 10,
  P20: 2,
  P30: 0,
  P50: 0,
  P100: 0,
};

async function main() {
  const [inspection, policy, requestStatus, deviceStatus, openTechnicalAlerts] = await Promise.all([
    prisma.thermalInspection.findUnique({
      where: { sourceReference: LEGACY_DEMO_INSPECTION_REFERENCE },
      include: { findings: { select: { companyPriority: true, sourcePriorityLabel: true, thermalPoint: { select: { code: true } } } } },
    }),
    prisma.thermalPriorityPolicy.findUnique({ where: { version: DEMO_PRIORITY_POLICY_VERSION } }),
    prisma.inferenceRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.sensorDevice.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.deviceTechnicalAlert.count({ where: { status: "OPEN" } }),
  ]);

  if (!inspection || !inspection.immutable) throw new Error("Inspeção histórica original imutável não encontrada.");
  if (!policy) throw new Error("Política térmica versionada da demonstração não encontrada.");

  const distribution = { P5: 0, P10: 0, P20: 0, P30: 0, P50: 0, P100: 0 } satisfies Record<CompanyThermalPriority, number>;
  inspection.findings.forEach((finding) => distribution[finding.companyPriority]++);
  for (const [priority, expected] of Object.entries(LEGACY_DEMO_EXPECTED_DISTRIBUTION)) {
    if (distribution[priority as CompanyThermalPriority] !== expected) {
      throw new Error(`Distribuição histórica divergente em ${priority}: esperado ${expected}.`);
    }
  }

  const tp039 = inspection.findings.find((finding) => finding.thermalPoint.code === "TP-039");
  if (tp039?.companyPriority !== "P20" || tp039.sourcePriorityLabel !== "Prioridade 3") {
    throw new Error("TP-039 não preserva o registro histórico Prioridade 3 / P20.");
  }

  process.stdout.write(`${JSON.stringify({
    status: "ok",
    inspection: {
      sourceReference: inspection.sourceReference,
      immutable: inspection.immutable,
      findingCount: inspection.findings.length,
      distribution,
      tp039: { sourcePriorityLabel: tp039.sourcePriorityLabel, companyPriority: tp039.companyPriority },
    },
    priorityPolicy: { version: policy.version, status: policy.status, validatedLevels: policy.validatedLevels },
    queue: Object.fromEntries(requestStatus.map((row) => [row.status, row._count._all])),
    devices: Object.fromEntries(deviceStatus.map((row) => [row.status, row._count._all])),
    openTechnicalAlerts,
  })}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
