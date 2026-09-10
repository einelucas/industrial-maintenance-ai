import type { CompanyThermalPriority } from "@prisma/client";

export const DEMO_PRIORITY_POLICY_VERSION = "gpms2026-demo-priority-v1";

export const COMPANY_PRIORITY_LABELS: Record<CompanyThermalPriority, string> = {
  P5: "P5 · Intensificar monitoramento",
  P10: "P10 · Intervir em parada programada",
  P20: "P20 · Intervir em até 30 dias",
  P30: "P30 · Definição empresarial pendente",
  P50: "P50 · Definição empresarial pendente",
  P100: "P100 · Definição empresarial pendente",
};
