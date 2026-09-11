import type { IncidentStatus } from "@prisma/client";
export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: "Aberto", ACKNOWLEDGED: "Reconhecido", UNDER_ANALYSIS: "Em análise", DISMISSED: "Descartado",
  PENDING_HUMAN_REVIEW: "Aguardando revisão humana", HUMAN_CONFIRMED: "Defeito confirmado", HUMAN_REJECTED: "Defeito rejeitado",
  INCONCLUSIVE: "Inconclusivo", NEW_READING_REQUIRED: "Nova leitura solicitada", WORK_ORDER_CREATED: "OS criada",
  MONITORING_AFTER_ACTION: "Monitoramento pós-ação", NORMALIZED: "Normalizado",
};
export const REVIEW_LABELS = { CONFIRMED: "Confirmar defeito", REJECTED: "Rejeitar", INCONCLUSIVE: "Inconclusivo", NEW_READING_REQUIRED: "Solicitar nova leitura" } as const;

// Reformula em frase de ação os mesmos estados já descritos por
// INCIDENT_STATUS_LABELS — não introduz nenhuma transição ou estado novo,
// só traduz "o que fazer agora" a partir do status que já existe.
export function incidentNextAction(status: IncidentStatus, workOrderId: string | null): string {
  switch (status) {
    case "OPEN":
    case "ACKNOWLEDGED":
    case "UNDER_ANALYSIS":
      return "Aguardar consolidação da IA";
    case "PENDING_HUMAN_REVIEW":
      return "Revisar e decidir";
    case "HUMAN_CONFIRMED":
      return workOrderId ? "Acompanhar OS" : "Autorizar OS";
    case "NEW_READING_REQUIRED":
      return "Aguardar nova leitura";
    case "INCONCLUSIVE":
      return "Avaliar novamente";
    case "HUMAN_REJECTED":
    case "DISMISSED":
      return "Nenhuma ação pendente";
    case "WORK_ORDER_CREATED":
      return "Acompanhar OS";
    case "MONITORING_AFTER_ACTION":
      return "Monitorar pós-ação";
    case "NORMALIZED":
      return "Ciclo encerrado";
    default:
      return "—";
  }
}

export function workOrderBlockReason(input: { aiStatus: string; canConvert: boolean; status: string; decision: string | null; workOrderId: string | null; equipmentId: string | null; validEvidence: boolean; finalCompanyPriority: string | null; priorityPolicyVersion: string | null }): string | null {
  if (!input.canConvert) return "Seu perfil não permite autorizar OS preditiva.";
  if (input.workOrderId) return "Este incidente já possui uma OS vinculada.";
  if (input.aiStatus !== "READY") return "A IA precisa estar pronta para autorizar uma nova OS preditiva.";
  if (!input.validEvidence) return "A evidência da IA não possui proveniência válida.";
  if (input.status !== "HUMAN_CONFIRMED" || input.decision !== "CONFIRMED") return "Confirme o defeito na revisão humana antes de autorizar a OS.";
  if (!input.finalCompanyPriority || !input.priorityPolicyVersion) return "A confirmação anterior não registrou a versão da política empresarial. Confirme novamente a decisão ao lado.";
  if (!input.equipmentId) return "O painel precisa estar vinculado a um equipamento real para receber uma OS.";
  return null;
}
