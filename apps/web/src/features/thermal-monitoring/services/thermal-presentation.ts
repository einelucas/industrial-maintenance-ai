import type { AnalysisStatus, CompanyThermalPriority, DeviceStatus, MonitoringMode, Prediction, RiskLevel, ThermalCause } from "@prisma/client";
import { thermalInferenceResponseSchema } from "@/features/ai-core/schemas/thermal-inference-response.schema";
import type { AiCoreStateStatus } from "@/features/ai-core/services/ai-core-state.service";

export const RISK_LABELS: Record<RiskLevel, string> = { LOW: "Normal", MODERATE: "Atenção", HIGH: "Alto", CRITICAL: "Crítico" };
export const THERMAL_CAUSE_LABELS: Record<ThermalCause, string> = {
  LOOSE_CONNECTION: "Conexão frouxa",
  CONTACT_RESISTANCE: "Resistência elevada de contato",
  OVERLOAD: "Sobrecarga",
  PHASE_IMBALANCE: "Desequilíbrio entre fases",
  DEGRADED_CONTACT: "Contato degradado",
  INSUFFICIENT_VENTILATION: "Ventilação insuficiente",
  THERMAL_RELAY_DEGRADATION: "Degradação de relé térmico",
  PROCESS_CONDITION: "Condição do processo",
  SENSOR_ERROR: "Possível erro de sensor",
  NOT_CONFIRMED: "Não confirmado",
  OTHER: "Outra hipótese",
};
export const CONNECTIVITY_LABELS = {
  ONLINE: "Com comunicação", OFFLINE: "Sem comunicação", DEGRADED: "Comunicação degradada",
  NOT_APPLICABLE: "Coleta manual / importada / simulada", UNPROVISIONED: "Sem dispositivo ativo",
};
export type Connectivity = keyof typeof CONNECTIVITY_LABELS;

export type TraceablePrediction = Prediction & {
  thermalReading: { id: string; thermalPointId: string; measuredAt: Date; source: MonitoringMode; analysisStatus: AnalysisStatus } | null;
  inferenceRequest: { inferenceRequestId: string; status: string; predictionId: string | null; thermalReadingId: string; thermalPointId: string; featureVersion: string } | null;
};

// Valida a evidência persistida pelo mesmo contrato da Etapa 5. Nunca interpreta temperatura.
export function isTraceablePrediction(prediction: TraceablePrediction): boolean {
  const request = prediction.inferenceRequest;
  const reading = prediction.thermalReading;
  if (!request || !reading || !prediction.featureVersion || request.status !== "SUCCEEDED" ||
    request.predictionId !== prediction.id || request.inferenceRequestId !== prediction.inferenceRequestId ||
    request.thermalReadingId !== prediction.thermalReadingId || reading.id !== prediction.thermalReadingId ||
    reading.thermalPointId !== prediction.thermalPointId || request.thermalPointId !== prediction.thermalPointId ||
    request.featureVersion !== prediction.featureVersion) return false;
  return thermalInferenceResponseSchema.safeParse({
    inferenceId: prediction.inferenceId, inferenceRequestId: prediction.inferenceRequestId,
    modelVersion: prediction.modelVersion, modelChecksum: prediction.modelChecksum, modelStage: prediction.modelStage,
    supervisedFailureProbability: prediction.failureProbability,
    modelScore: prediction.modelScore, riskScore: prediction.riskScore, riskLevel: prediction.riskLevel,
    confidence: prediction.confidence, predictedFailureMode: prediction.predictedFailureMode,
    failureModeConfidence: prediction.failureModeConfidence, explanations: prediction.explanations,
    recommendedAction: prediction.recommendedAction,
  }).success;
}

export function pointConnectivity(point: {
  monitoringMode: MonitoringMode; sampleIntervalSec: number;
  devices: { status: DeviceStatus; lastSeenAt: Date | null }[];
}, now: Date): Connectivity {
  if (["MANUAL", "CSV", "SIMULATOR"].includes(point.monitoringMode)) return "NOT_APPLICABLE";
  const active = point.devices.filter((d) => !["DISABLED", "MAINTENANCE"].includes(d.status));
  if (!active.length) return "UNPROVISIONED";
  // Tolerância de três intervalos de amostragem. Estado de comunicação, nunca de risco.
  const recent = active.filter((d) => d.lastSeenAt && now.getTime() - d.lastSeenAt.getTime() <= point.sampleIntervalSec * 3000);
  if (recent.some((d) => d.status === "ONLINE")) return "ONLINE";
  if (recent.some((d) => d.status === "DEGRADED")) return "DEGRADED";
  return "OFFLINE";
}

export function currentPointRisk(
  reading: { id: string; analysisStatus: AnalysisStatus } | undefined,
  prediction: TraceablePrediction | undefined, aiStatus: AiCoreStateStatus,
): RiskLevel | null {
  if (aiStatus !== "READY" || !reading || reading.analysisStatus !== "ANALYZED" ||
    !prediction || prediction.thermalReadingId !== reading.id || !isTraceablePrediction(prediction)) return null;
  return prediction.riskLevel;
}

export interface MonitoringFilters {
  search?: string; sectorId?: string; equipmentId?: string; panelId?: string; componentId?: string;
  risk?: string; connectivity?: string;
  companyPriority?: string; openIncident?: string;
}

export interface FilterablePoint {
  code: string; name: string; currentRisk: RiskLevel | null; connectivity: Connectivity; historicalPriority: CompanyThermalPriority | null;
  component: { id: string; panel: { id: string; sectorId: string; equipmentId: string | null } };
  hasOpenIncident?: boolean;
}

export function filterMonitoringPoints<T extends FilterablePoint>(points: T[], filters: MonitoringFilters): T[] {
  const search = filters.search?.trim().toLocaleLowerCase("pt-BR");
  return points.filter((p) => (!search || `${p.code} ${p.name}`.toLocaleLowerCase("pt-BR").includes(search)) &&
    (!filters.sectorId || p.component.panel.sectorId === filters.sectorId) &&
    (!filters.equipmentId || p.component.panel.equipmentId === filters.equipmentId) &&
    (!filters.panelId || p.component.panel.id === filters.panelId) &&
    (!filters.componentId || p.component.id === filters.componentId) &&
    (!filters.risk || (filters.risk === "PENDING_AI" ? p.currentRisk === null : p.currentRisk === filters.risk)) &&
    (!filters.companyPriority || p.historicalPriority === filters.companyPriority) &&
    (!filters.connectivity || p.connectivity === filters.connectivity) &&
    (!filters.openIncident || p.hasOpenIncident === true));
}

export function summarizeMonitoringPoints(points: { currentRisk: RiskLevel | null; connectivity: Connectivity }[]) {
  const counts = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
  for (const point of points) if (point.currentRisk) counts[point.currentRisk]++;
  return { total: points.length, counts, unclassified: points.filter((p) => !p.currentRisk).length,
    offline: points.filter((p) => p.connectivity === "OFFLINE").length };
}

// Quebra de conectividade pelos 5 estados possíveis — usada no painel de
// "Saúde da operação". Separada de summarizeMonitoringPoints (que já tem
// contrato de teste fixo) para não alterar sua assinatura.
export function connectivitySummary(points: { connectivity: Connectivity }[]): Record<Connectivity, number> {
  const counts: Record<Connectivity, number> = { ONLINE: 0, OFFLINE: 0, DEGRADED: 0, NOT_APPLICABLE: 0, UNPROVISIONED: 0 };
  for (const point of points) counts[point.connectivity]++;
  return counts;
}

export function numeric(value: number | null | undefined, unit = ""): string {
  return value == null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unit}`;
}

export function inferenceAge(date: Date | null | undefined, now: Date): string {
  if (!date) return "Nenhuma inferência válida";
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  return minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 1440)} dias`;
}
