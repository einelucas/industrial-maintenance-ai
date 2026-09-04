import { z } from "zod";

export const workOrderStatusTransitionSchema = z.object({
  workOrderId: z.string().uuid(),
  newStatus: z.enum([
    "OPEN",
    "PLANNED",
    "IN_PROGRESS",
    "WAITING_MATERIAL",
    "PAUSED",
    "COMPLETED",
    "CANCELED",
  ]),
  notes: z.string().optional(),
});

// AI-first / fail-closed (GPMS 2026 / Etapa 3): o tipo `PREDICTIVE` e o
// campo `sourcePredictionId` foram deliberadamente removidos deste schema
// genérico. Uma OS preditiva só pode nascer do fluxo interno dedicado
// `Prediction válida -> ThermalIncident -> revisão humana CONFIRMED ->
// WorkOrder PREDICTIVE` (preparado nas etapas 5+); o único caminho
// existente hoje que cria `WorkOrder.type = "PREDICTIVE"` é
// `alertService.convertToWorkOrder()`, que nunca passa por este schema —
// ele grava direto via `prisma.$transaction`, com `sourcePredictionId`
// derivado de um `Alert` real (proveniência garantida por FK), nunca de
// entrada de formulário. Enquanto a revisão humana (Etapa 5) não existir,
// este formulário genérico não pode oferecer nem aceitar `PREDICTIVE` de
// forma alguma — a proteção é estrutural: o valor não existe no enum, então
// nenhuma entrada de cliente pode produzi-lo aqui, mesmo forjada.
export const createWorkOrderSchema = z.object({
  title: z.string().min(3, "Título é obrigatório."),
  description: z.string().optional(),
  type: z.enum(["CORRECTIVE", "PREVENTIVE", "INSPECTION", "IMPROVEMENT"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  equipmentId: z.string().uuid("Selecione um equipamento válido."),
  assignedUserId: z.string().uuid().optional().or(z.literal("")),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  estimatedHours: z.coerce.number().optional(),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type WorkOrderStatusTransitionInput = z.infer<typeof workOrderStatusTransitionSchema>;

// Transições de status válidas — evita, por exemplo, reabrir uma OS cancelada
// diretamente para "Em andamento" sem passar por planejamento.
export const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["PLANNED", "IN_PROGRESS", "CANCELED"],
  PLANNED: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["WAITING_MATERIAL", "PAUSED", "COMPLETED", "CANCELED"],
  WAITING_MATERIAL: ["IN_PROGRESS", "CANCELED"],
  PAUSED: ["IN_PROGRESS", "CANCELED"],
  COMPLETED: [],
  CANCELED: [],
};
