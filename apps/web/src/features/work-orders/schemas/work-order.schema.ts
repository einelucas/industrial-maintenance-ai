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

export const createWorkOrderSchema = z.object({
  title: z.string().min(3, "Título é obrigatório."),
  description: z.string().optional(),
  type: z.enum(["CORRECTIVE", "PREVENTIVE", "PREDICTIVE", "INSPECTION", "IMPROVEMENT"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  equipmentId: z.string().uuid("Selecione um equipamento válido."),
  assignedUserId: z.string().uuid().optional().or(z.literal("")),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  estimatedHours: z.coerce.number().optional(),
  sourcePredictionId: z.string().uuid().optional(),
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
