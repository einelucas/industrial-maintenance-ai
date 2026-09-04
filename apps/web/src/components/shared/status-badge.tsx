import { Badge } from "@/components/ui/badge";
import type { RiskLevel, WorkOrderStatus, WorkOrderPriority, EquipmentStatus, AlertSeverity, AnalysisStatus } from "@prisma/client";

// Mapeamento único de cor por nível de risco/severidade/status (seção 31):
// normal -> neutro/verde, atenção -> amarelo, alto risco -> laranja, crítico -> vermelho.

const RISK_VARIANT: Record<RiskLevel, "neutral" | "attention" | "high" | "critical"> = {
  LOW: "neutral",
  MODERATE: "attention",
  HIGH: "high",
  CRITICAL: "critical",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "Baixo",
  MODERATE: "Moderado",
  HIGH: "Alto",
  CRITICAL: "Crítico",
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge variant={RISK_VARIANT[level]}>{RISK_LABEL[level]}</Badge>;
}

export function AlertSeverityBadge({ severity }: { severity: AlertSeverity }) {
  return <Badge variant={RISK_VARIANT[severity]}>{RISK_LABEL[severity]}</Badge>;
}

const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  OPEN: "Aberta",
  PLANNED: "Planejada",
  IN_PROGRESS: "Em andamento",
  WAITING_MATERIAL: "Aguardando material",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};

const WORK_ORDER_STATUS_VARIANT: Record<WorkOrderStatus, "neutral" | "attention" | "high" | "critical" | "muted"> = {
  OPEN: "muted",
  PLANNED: "neutral",
  IN_PROGRESS: "attention",
  WAITING_MATERIAL: "high",
  PAUSED: "muted",
  COMPLETED: "neutral",
  CANCELED: "muted",
};

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  return <Badge variant={WORK_ORDER_STATUS_VARIANT[status]}>{WORK_ORDER_STATUS_LABEL[status]}</Badge>;
}

const PRIORITY_LABEL: Record<WorkOrderPriority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};
const PRIORITY_VARIANT: Record<WorkOrderPriority, "neutral" | "attention" | "high" | "critical"> = {
  LOW: "neutral",
  MEDIUM: "attention",
  HIGH: "high",
  CRITICAL: "critical",
};
export function PriorityBadge({ priority }: { priority: WorkOrderPriority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}

const EQUIPMENT_STATUS_LABEL: Record<EquipmentStatus, string> = {
  OPERATIONAL: "Operacional",
  MAINTENANCE: "Em manutenção",
  STOPPED: "Parado",
  INACTIVE: "Inativo",
};
const EQUIPMENT_STATUS_VARIANT: Record<EquipmentStatus, "neutral" | "attention" | "high" | "muted"> = {
  OPERATIONAL: "neutral",
  MAINTENANCE: "attention",
  STOPPED: "high",
  INACTIVE: "muted",
};
export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  return <Badge variant={EQUIPMENT_STATUS_VARIANT[status]}>{EQUIPMENT_STATUS_LABEL[status]}</Badge>;
}

// Domínio termográfico AI-first (GPMS 2026 / Etapa 3+): a ausência de uma
// Prediction NUNCA deve ser lida como "normal" — por isso usa a variante
// "muted" (neutra/cinza), nunca "neutral" (que no resto do app já significa
// "risco baixo/operacional", ou seja, um veredito, não uma ausência dele).
export function AwaitingAiAnalysisBadge() {
  return <Badge variant="muted">Aguardando análise da IA</Badge>;
}

// Estado de análise de uma leitura individual (GPMS 2026 / Etapa 4). Mesma
// regra: nenhuma destas variantes é "neutral" (que já significa "risco
// baixo" em outros lugares do app) — a ausência ou falha de análise nunca é
// pintada como se fosse um veredito de normalidade.
const ANALYSIS_STATUS_LABEL: Record<AnalysisStatus, string> = {
  PENDING_AI: "Aguardando IA",
  ANALYZED: "Analisada",
  AI_FAILED: "Falha na IA",
  SUPERSEDED: "Substituída",
};

const ANALYSIS_STATUS_VARIANT: Record<AnalysisStatus, "muted" | "attention"> = {
  PENDING_AI: "muted",
  ANALYZED: "muted",
  AI_FAILED: "attention",
  SUPERSEDED: "muted",
};

export function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  return <Badge variant={ANALYSIS_STATUS_VARIANT[status]}>{ANALYSIS_STATUS_LABEL[status]}</Badge>;
}
