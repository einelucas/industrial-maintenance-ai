import type { Prisma } from "@prisma/client";

// Resolução de Equipment a partir de um ThermalPoint (GPMS 2026 / Etapa 5) —
// usada por Prediction/Alert/WorkOrder térmicos. Devolve `null` quando o
// painel do ponto está ligado só a um setor (sem equipamento) — nunca
// inventa um Equipment falso para preencher a lacuna.
export type PointWithPanelHierarchy = Prisma.ThermalPointGetPayload<{
  include: { component: { include: { panel: true } } };
}>;

export function resolveEquipmentIdFromPoint(point: PointWithPanelHierarchy): string | null {
  return point.component.panel.equipmentId ?? null;
}
