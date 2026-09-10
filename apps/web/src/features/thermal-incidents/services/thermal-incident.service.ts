import { prisma } from "@/lib/db/client";
import type { Prediction, RiskLevel, IncidentStatus } from "@prisma/client";
import { thermalAlertService } from "@/features/thermal-incidents/services/thermal-alert.service";
import type { PointWithPanelHierarchy } from "@/features/ai-core/services/resolve-equipment-for-point";

// Ciclo de vida do incidente térmico consolidado (GPMS 2026 / Etapa 5).
// Único lugar que cria/atualiza `ThermalIncident` — nunca chamado a partir
// de uma leitura ou threshold isolado, sempre a partir de uma `Prediction`
// já persistida com sucesso (o chamador, `thermal-orchestrator.service.ts`,
// garante essa ordem).

const RISK_ORDER: Record<RiskLevel, number> = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 };

// Quantas predições consecutivas (as N mais recentes do ponto, incluindo a
// atual) precisam bater ou superar o nível para abrir/escalar. `null` =
// nunca abre incidente sozinho (LOW só fica registrado como Prediction).
const REQUIRED_CONSECUTIVE: Record<RiskLevel, number | null> = {
  CRITICAL: 1,
  HIGH: 2,
  MODERATE: 3,
  LOW: null,
};

// Incidente "ativo" — ainda pode ser escalado/atualizado pela IA. Uma vez
// rejeitado, normalizado ou levado à execução de uma OS, uma nova anomalia
// abre um NOVO ciclo de incidente em vez de reabrir o anterior.
const DEDUP_ELIGIBLE_STATUSES: IncidentStatus[] = ["PENDING_HUMAN_REVIEW", "HUMAN_CONFIRMED", "INCONCLUSIVE", "NEW_READING_REQUIRED"];

export const thermalIncidentService = {
  /**
   * Avalia elegibilidade e, se aplicável, abre ou escala o incidente do
   * ponto — de forma segura contra concorrência (lock consultivo do
   * Postgres por `thermalPointId`, nunca um `findFirst()` seguido de
   * `create()` desprotegido). Devolve `null` quando a Prediction não é
   * elegível (LOW, ou persistência ainda não confirmada pelas N predições
   * consecutivas exigidas pelo nível).
   */
  async evaluateAndUpsert(
    prediction: Prediction,
    point: PointWithPanelHierarchy,
    currentTemperatureMaxC: number,
    currentDeltaTC: number | null
  ) {
    if (!prediction.thermalPointId || !prediction.riskLevel || prediction.riskScore === null) {
      return null;
    }
    // Extraído para variáveis locais logo após o guard acima: o
    // estreitamento de tipo do TypeScript em `prediction.thermalPointId`
    // não sobrevive dentro do closure da transação abaixo (é acesso a
    // propriedade, não a uma variável local), então precisamos da cópia
    // local para o compilador (e para nós) termos certeza de que não é null
    // em nenhum ponto daqui pra frente.
    const thermalPointId = prediction.thermalPointId;
    const riskLevel = prediction.riskLevel;
    const riskScore = prediction.riskScore;
    const requiredConsecutive = REQUIRED_CONSECUTIVE[riskLevel];
    if (requiredConsecutive === null) return null;

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${thermalPointId}))`;

      const recent = await tx.prediction.findMany({
        where: { thermalPointId },
        orderBy: { createdAt: "desc" },
        take: requiredConsecutive,
        select: { riskLevel: true },
      });
      if (recent.length < requiredConsecutive) return null;
      const eligible = recent.every((p) => p.riskLevel !== null && RISK_ORDER[p.riskLevel] >= RISK_ORDER[riskLevel]);
      if (!eligible) return null;

      const existing = await tx.thermalIncident.findFirst({
        where: { thermalPointId, status: { in: DEDUP_ELIGIBLE_STATUSES } },
      });

      if (existing) {
        const nextSeverity = RISK_ORDER[riskLevel] > RISK_ORDER[existing.severity] ? riskLevel : existing.severity;
        const updated = await tx.thermalIncident.update({
          where: { id: existing.id },
          data: {
            severity: nextSeverity,
            peakTemperatureC: Math.max(existing.peakTemperatureC, currentTemperatureMaxC),
            peakDeltaTC:
              existing.peakDeltaTC !== null && currentDeltaTC !== null
                ? Math.max(existing.peakDeltaTC, currentDeltaTC)
                : (existing.peakDeltaTC ?? currentDeltaTC),
            lastRiskScore: riskScore,
            triggerCount: { increment: 1 },
            recommendedCompanyPriority: prediction.recommendedCompanyPriority,
            priorityPolicyVersion: prediction.priorityPolicyVersion,
          },
        });
        await thermalAlertService.upsertForIncident(tx, updated, prediction, point);
        return updated;
      }

      const created = await tx.thermalIncident.create({
        data: {
          thermalPointId,
          status: "PENDING_HUMAN_REVIEW",
          severity: riskLevel,
          peakTemperatureC: currentTemperatureMaxC,
          peakDeltaTC: currentDeltaTC,
          lastRiskScore: riskScore,
          triggerPredictionId: prediction.id,
          triggerCount: 1,
          recommendedCompanyPriority: prediction.recommendedCompanyPriority,
          priorityPolicyVersion: prediction.priorityPolicyVersion,
        },
      });
      await thermalAlertService.upsertForIncident(tx, created, prediction, point);
      return created;
    });
  },
};
