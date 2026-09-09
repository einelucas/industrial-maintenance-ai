/**
 * Pré-voo somente leitura da demonstração oficial.
 * Não executa seed, backfill, review, OS, migration ou qualquer escrita.
 */
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const webRoot = path.resolve(__dirname, "..");
try {
  process.loadEnvFile(path.join(webRoot, ".env"));
} catch {
  // Em CI/deploy as variáveis podem vir integralmente do ambiente.
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

function approximate(value: number | null | undefined, expected: number): boolean {
  return value != null && Math.abs(value - expected) < 0.001;
}

function safeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Falha não identificada.";
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgresql://[REDACTED]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]");
}

async function main() {
  const checks: Check[] = [];
  const warnings: string[] = [];
  const prisma = new PrismaClient();

  try {
    const required = ["DATABASE_URL", "AUTH_SECRET", "AI_SERVICE_API_KEY", "CRON_SECRET"];
    const missing = required.filter((name) => !process.env[name]?.trim());
    checks.push({
      name: "configuration",
      ok: missing.length === 0,
      detail: missing.length ? `Variáveis ausentes: ${missing.join(", ")}.` : "Variáveis obrigatórias presentes (valores não exibidos).",
    });

    const { thermalAiGateway } = await import("../src/features/ai-core/services/thermal-ai-gateway.service");
    const { isTraceablePrediction } = await import("../src/features/thermal-monitoring/services/thermal-presentation");
    const { predictionEvidenceInclude } = await import("../src/features/thermal-monitoring/repositories/thermal-monitoring.repository");

    const readiness = await thermalAiGateway.checkReadiness();
    checks.push({
      name: "thermal-ai",
      ok: readiness.ready,
      detail: readiness.ready
        ? `Modelo ${readiness.modelVersion ?? "sem versão"} (${readiness.modelStage ?? "sem estágio"}) pronto.`
        : readiness.reason ?? "Núcleo de IA térmica indisponível.",
    });

    const [pointCount, initiallyAnomalousCount, readingStatus, point, incident, activePresenters] = await Promise.all([
      prisma.thermalPoint.count(),
      prisma.thermalPoint.count({ where: { initiallyAnomalous: true } }),
      prisma.thermalReading.groupBy({ by: ["analysisStatus"], _count: { _all: true } }),
      prisma.thermalPoint.findUnique({
        where: { code: "TP-039" },
        include: { component: { include: { panel: true } } },
      }),
      prisma.thermalIncident.findFirst({
        where: { thermalPoint: { code: "TP-039" } },
        orderBy: { openedAt: "desc" },
        include: {
          triggerPrediction: { include: predictionEvidenceInclude },
          humanReviews: true,
          workOrder: true,
        },
      }),
      prisma.user.count({ where: { active: true, role: { in: ["ADMIN", "PLANNER"] } } }),
    ]);

    checks.push({ name: "thermal-points", ok: pointCount === 55, detail: `${pointCount}/55 pontos cadastrados.` });
    checks.push({
      name: "reserved-markers",
      ok: initiallyAnomalousCount === 19,
      detail: `${initiallyAnomalousCount}/19 marcadores reservados presentes; não são usados para inferência.`,
    });
    checks.push({ name: "presenter-user", ok: activePresenters > 0, detail: `${activePresenters} usuário(s) ADMIN/PLANNER ativo(s).` });
    checks.push({
      name: "tp-039-equipment",
      ok: Boolean(point?.component.panel.equipmentId),
      detail: point?.component.panel.equipmentId ? "TP-039 vinculado a equipamento real." : "TP-039 sem equipamento vinculado; criação de OS ficará bloqueada.",
    });

    const traceable = incident ? isTraceablePrediction(incident.triggerPrediction) : false;
    const officialMeasurements = Boolean(
      incident && approximate(incident.peakTemperatureC, 75.6) && approximate(incident.peakDeltaTC, 35.6),
    );
    checks.push({
      name: "official-critical-case",
      ok: Boolean(incident && incident.severity === "CRITICAL" && officialMeasurements),
      detail: incident
        ? `Pico ${incident.peakTemperatureC.toFixed(1)} °C, deltaT ${incident.peakDeltaTC?.toFixed(1) ?? "—"} °C, score ${incident.lastRiskScore.toFixed(1)}.`
        : "Incidente do TP-039 não encontrado.",
    });
    checks.push({
      name: "traceable-prediction",
      ok: traceable,
      detail: traceable ? "Prediction possui inferência, request, leitura, versão, checksum e estágio coerentes." : "Prediction ausente ou sem proveniência válida.",
    });

    const freshFlow = Boolean(
      incident &&
        incident.status === "PENDING_HUMAN_REVIEW" &&
        incident.humanReviews.length === 0 &&
        !incident.workOrderId &&
        !incident.workOrder,
    );
    checks.push({
      name: "fresh-demo-flow",
      ok: freshFlow,
      detail: !incident
        ? "Incidente oficial ausente."
        : freshFlow
          ? "Incidente aguarda revisão humana e ainda não possui OS."
          : `Cenário já consumido ou parcialmente executado: status=${incident.status}, revisões=${incident.humanReviews.length}, OS=${incident.workOrderId ? "sim" : "não"}.`,
    });

    const statuses = Object.fromEntries(readingStatus.map((item) => [item.analysisStatus, item._count._all]));
    const pending = statuses.PENDING_AI ?? 0;
    const analyzed = statuses.ANALYZED ?? 0;
    const failed = statuses.AI_FAILED ?? 0;
    if (pending > 0 || failed > 0) {
      warnings.push(
        `Backlog informativo: PENDING_AI=${pending}, ANALYZED=${analyzed}, AI_FAILED=${failed}. Não bloqueia o caso oficial já preparado.`,
      );
    }

    const failedChecks = checks.filter((check) => !check.ok);
    const report = {
      status: failedChecks.length === 0 ? "READY" : "NOT_READY",
      readOnly: true,
      checkedAt: new Date().toISOString(),
      checks,
      warnings,
    };
    console.log(JSON.stringify(report, null, 2));
    if (failedChecks.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ status: "NOT_READY", readOnly: true, error: safeError(error) }, null, 2));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
