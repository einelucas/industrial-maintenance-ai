import { z } from "zod";

export const failureEventSchema = z.object({
  equipmentId: z.string().uuid(),
  occurredAt: z.string().min(1, "Informe a data/hora da falha."),
  description: z.string().optional(),
  workOrderId: z.string().uuid().optional().or(z.literal("")),
});

export type FailureEventInput = z.infer<typeof failureEventSchema>;
