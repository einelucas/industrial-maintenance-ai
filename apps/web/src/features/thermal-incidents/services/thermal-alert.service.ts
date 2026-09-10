import type { Prisma, ThermalIncident, Prediction } from "@prisma/client";
import { resolveEquipmentIdFromPoint, type PointWithPanelHierarchy } from "@/features/ai-core/services/resolve-equipment-for-point";

type Tx = Prisma.TransactionClient;

const SEVERITY_ORDER = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 } as const;

// Alerta térmico consolidado (GPMS 2026 / Etapa 5) — um Alert por
// ThermalIncident (não um por leitura/predição). Chamado só de dentro da
// transação do incidente (`thermal-incident.service.ts`), nunca
// diretamente. Não envia notificação externa nenhuma nesta etapa — só
// registra o alerta interno, que é o suficiente por enquanto (seção 9 do
// prompt da Etapa 5).
export const thermalAlertService = {
  async upsertForIncident(
    tx: Tx,
    incident: ThermalIncident,
    prediction: Prediction,
    point: PointWithPanelHierarchy
  ) {
    const existing = await tx.alert.findUnique({ where: { thermalIncidentId: incident.id } });

    if (existing) {
      const nextSeverity = SEVERITY_ORDER[incident.severity] > SEVERITY_ORDER[existing.severity] ? incident.severity : existing.severity;
      const escalated = nextSeverity !== existing.severity;
      return tx.alert.update({
        where: { id: existing.id },
        data: {
          severity: nextSeverity,
          lastTriggeredAt: new Date(),
          triggerCount: { increment: 1 },
          peakTemperatureC: incident.peakTemperatureC,
          peakDeltaTC: incident.peakDeltaTC,
          ...(escalated ? { escalatedAt: new Date() } : {}),
          companyPriority: incident.recommendedCompanyPriority,
          priorityPolicyVersion: incident.priorityPolicyVersion,
        },
      });
    }

    const equipmentId = resolveEquipmentIdFromPoint(point);

    return tx.alert.create({
      data: {
        equipmentId,
        predictionId: prediction.id,
        type: "PREDICTIVE_RISK",
        severity: incident.severity,
        status: "OPEN",
        title: `Incidente térmico — ${point.code}`,
        description: prediction.recommendedAction,
        thermalIncidentId: incident.id,
        firstTriggeredAt: new Date(),
        lastTriggeredAt: new Date(),
        triggerCount: 1,
        peakTemperatureC: incident.peakTemperatureC,
        peakDeltaTC: incident.peakDeltaTC,
        companyPriority: incident.recommendedCompanyPriority,
        priorityPolicyVersion: incident.priorityPolicyVersion,
      },
    });
  },
};
