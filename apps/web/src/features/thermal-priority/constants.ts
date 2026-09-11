import type { CompanyThermalPriority } from "@prisma/client";

// Identificador legado interno de uma política demonstrativa já semeada no
// banco (ThermalPriorityPolicy.version, chave única) e referenciada por
// decisões humanas já registradas (HumanReview.priorityPolicyVersion). Não é
// exibido como marca — quando aparece na timeline de auditoria, é o valor
// histórico real da decisão, que deve ser preservado como evidência.
export const DEMO_PRIORITY_POLICY_VERSION = "gpms2026-demo-priority-v1";

// Escala de prioridade térmica da organização.
export const COMPANY_PRIORITY_LABELS: Record<CompanyThermalPriority, string> = {
  P5: "P5 · Intensificar monitoramento",
  P10: "P10 · Intervir em parada programada",
  P20: "P20 · Intervir em até 30 dias",
  P30: "P30 · Política não configurada",
  P50: "P50 · Política não configurada",
  P100: "P100 · Política não configurada",
};
