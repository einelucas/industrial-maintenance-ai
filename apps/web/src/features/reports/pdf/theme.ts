// @react-pdf/renderer usa seus próprios primitivos (View/Text/StyleSheet),
// incompatíveis com os componentes DOM/Tailwind do resto do app — por isso
// as cores e os rótulos PT-BR são duplicados aqui a partir de
// globals.css/tailwind.config.ts e src/components/shared/status-badge.tsx,
// em vez de importados.

export const COLORS = {
  primary: "#1c4e80",
  foreground: "#1f2430",
  muted: "#6b7280",
  border: "#d9dee5",
  background: "#f7f9fb",
  neutral: "#1f8a55",
  attention: "#c68a17",
  high: "#d1671a",
  critical: "#c0293c",
};

export const WORK_ORDER_STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberta",
  PLANNED: "Planejada",
  IN_PROGRESS: "Em andamento",
  WAITING_MATERIAL: "Aguardando material",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
};

export const WORK_ORDER_TYPE_LABEL: Record<string, string> = {
  CORRECTIVE: "Corretiva",
  PREVENTIVE: "Preventiva",
  PREDICTIVE: "Preditiva",
  INSPECTION: "Inspeção",
  IMPROVEMENT: "Melhoria",
};

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const RISK_LABEL: Record<string, string> = {
  LOW: "Baixo",
  MODERATE: "Moderado",
  HIGH: "Alto",
  CRITICAL: "Crítico",
};

export const EQUIPMENT_STATUS_LABEL: Record<string, string> = {
  OPERATIONAL: "Operacional",
  MAINTENANCE: "Em manutenção",
  STOPPED: "Parado",
  INACTIVE: "Inativo",
};

export function riskColor(level: string): string {
  switch (level) {
    case "LOW":
      return COLORS.neutral;
    case "MODERATE":
      return COLORS.attention;
    case "HIGH":
      return COLORS.high;
    case "CRITICAL":
      return COLORS.critical;
    default:
      return COLORS.muted;
  }
}
