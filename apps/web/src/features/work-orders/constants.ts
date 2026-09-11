import type { WorkOrderType } from "@prisma/client";

// "Preditiva" existe apenas para exibição: ela nunca é oferecida como opção
// no formulário de criação manual (features/work-orders/components/work-order-form.tsx)
// porque só pode nascer do fluxo de incidente confirmado por um humano.
export const WORK_ORDER_TYPE_LABELS: Record<WorkOrderType, string> = {
  CORRECTIVE: "Corretiva",
  PREVENTIVE: "Preventiva",
  PREDICTIVE: "Preditiva",
  INSPECTION: "Inspeção",
  IMPROVEMENT: "Melhoria",
};
