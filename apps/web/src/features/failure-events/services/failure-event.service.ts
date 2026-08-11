import { failureEventRepository } from "@/features/failure-events/repositories/failure-event.repository";
import { failureEventSchema } from "@/features/failure-events/schemas/failure-event.schema";
import { ValidationError } from "@/lib/errors";

export const failureEventService = {
  listByEquipment: (equipmentId: string) => failureEventRepository.findByEquipment(equipmentId),

  /**
   * Captura uma falha REAL (diferente de Prediction, que é a estimativa da
   * IA) — base para retreinar o modelo com dados de produção no futuro.
   * Só a captura é implementada aqui; a exportação/retreino com esses dados
   * fica para quando houver volume real acumulado.
   */
  async register(input: unknown, createdById: string) {
    const parsed = failureEventSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados da falha inválidos.", parsed.error.flatten().fieldErrors);
    }
    const data = parsed.data;

    return failureEventRepository.create({
      equipment: { connect: { id: data.equipmentId } },
      occurredAt: new Date(data.occurredAt),
      description: data.description || undefined,
      workOrder: data.workOrderId ? { connect: { id: data.workOrderId } } : undefined,
      createdBy: { connect: { id: createdById } },
    });
  },
};
