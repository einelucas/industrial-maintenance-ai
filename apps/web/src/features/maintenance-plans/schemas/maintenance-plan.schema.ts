import { z } from "zod";

export const maintenancePlanSchema = z.object({
  name: z.string().min(3, "Nome é obrigatório."),
  description: z.string().optional(),
  equipmentId: z.string().uuid("Selecione um equipamento válido."),
  frequencyType: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM_DAYS"]),
  frequencyValue: z.coerce.number().int().min(1).default(1),
  nextExecution: z.string().min(1, "Informe a próxima execução."),
  estimatedHours: z.coerce.number().optional(),
  defaultAssigneeId: z.string().uuid().optional().or(z.literal("")),
  checklistItems: z.array(z.string()).optional(),
});

export type MaintenancePlanInput = z.infer<typeof maintenancePlanSchema>;

// Edição: o equipamento do plano não pode ser trocado (generateWorkOrder deriva
// o equipamento do plano, então reatribuí-lo poderia redirecionar preventivas
// futuras silenciosamente para outro ativo).
export const maintenancePlanUpdateSchema = maintenancePlanSchema.omit({ equipmentId: true });

export type MaintenancePlanUpdateInput = z.infer<typeof maintenancePlanUpdateSchema>;
