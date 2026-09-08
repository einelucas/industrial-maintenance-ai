import type { IncidentStatus } from "@prisma/client";
export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: "Aberto", ACKNOWLEDGED: "Reconhecido", UNDER_ANALYSIS: "Em análise", DISMISSED: "Descartado",
  PENDING_HUMAN_REVIEW: "Aguardando revisão humana", HUMAN_CONFIRMED: "Defeito confirmado", HUMAN_REJECTED: "Defeito rejeitado",
  INCONCLUSIVE: "Inconclusivo", NEW_READING_REQUIRED: "Nova leitura solicitada", WORK_ORDER_CREATED: "OS criada",
  MONITORING_AFTER_ACTION: "Monitoramento pós-ação", NORMALIZED: "Normalizado",
};
export const REVIEW_LABELS = { CONFIRMED: "Confirmar defeito", REJECTED: "Rejeitar", INCONCLUSIVE: "Inconclusivo", NEW_READING_REQUIRED: "Solicitar nova leitura" } as const;

export function workOrderBlockReason(input: { aiStatus: string; canConvert: boolean; status: string; decision: string | null; workOrderId: string | null; equipmentId: string | null; validEvidence: boolean }): string | null {
  if (!input.canConvert) return "Seu perfil não permite autorizar OS preditiva.";
  if (input.workOrderId) return "Este incidente já possui uma OS vinculada.";
  if (input.aiStatus !== "READY") return "A IA precisa estar pronta para autorizar uma nova OS preditiva.";
  if (!input.validEvidence) return "A evidência da IA não possui proveniência válida.";
  if (input.status !== "HUMAN_CONFIRMED" || input.decision !== "CONFIRMED") return "Confirme o defeito na revisão humana antes de autorizar a OS.";
  if (!input.equipmentId) return "O painel precisa estar vinculado a um equipamento real para receber uma OS.";
  return null;
}
