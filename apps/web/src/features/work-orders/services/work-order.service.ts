import { prisma } from "@/lib/db/client";
import { workOrderRepository, type WorkOrderFilters } from "@/features/work-orders/repositories/work-order.repository";
import { generateWorkOrderNumber } from "@/features/work-orders/services/work-order-number.service";
import {
  createWorkOrderSchema,
  VALID_TRANSITIONS,
  workOrderStatusTransitionSchema,
} from "@/features/work-orders/schemas/work-order.schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { canOperateWorkOrder } from "@/lib/permissions/policies";
import type { UserRole, WorkOrderStatus } from "@prisma/client";

export const workOrderService = {
  list: () => workOrderRepository.findAll(),

  listFiltered: (filters: WorkOrderFilters) => workOrderRepository.findFiltered(filters),

  async getOrThrow(id: string) {
    const workOrder = await workOrderRepository.findById(id);
    if (!workOrder) throw new NotFoundError("Ordem de Serviço", id);
    return workOrder;
  },

  async create(input: unknown, createdById: string) {
    const parsed = createWorkOrderSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados da ordem de serviço inválidos.", parsed.error.flatten().fieldErrors);
    }
    const data = parsed.data;
    const number = await generateWorkOrderNumber();

    // `data.type` nunca pode ser "PREDICTIVE" aqui — o schema genérico não
    // aceita esse valor (ver comentário em work-order.schema.ts). Uma OS
    // preditiva só nasce de `alertService.convertToWorkOrder()`, um fluxo
    // interno separado com proveniência real de `Prediction`.
    const workOrder = await prisma.workOrder.create({
      data: {
        number,
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority,
        status: "OPEN",
        equipment: { connect: { id: data.equipmentId } },
        createdBy: { connect: { id: createdById } },
        assignedUser: data.assignedUserId ? { connect: { id: data.assignedUserId } } : undefined,
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
        scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
        estimatedHours: data.estimatedHours,
      },
    });

    await workOrderRepository.addHistory({
      workOrder: { connect: { id: workOrder.id } },
      user: { connect: { id: createdById } },
      action: "CREATED",
      newStatus: "OPEN",
      description: `OS ${number} criada.`,
    });

    return workOrder;
  },

  /**
   * Transição de status transacional: atualiza a OS, registra histórico e,
   * ao concluir, marca actualEnd (seção 40 — transação para operações
   * relacionadas).
   */
  async transitionStatus(
    input: unknown,
    actor: { id: string; role: UserRole }
  ) {
    const parsed = workOrderStatusTransitionSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Transição de status inválida.", parsed.error.flatten().fieldErrors);
    }
    const { workOrderId, newStatus, notes } = parsed.data;

    const workOrder = await workOrderRepository.findById(workOrderId);
    if (!workOrder) throw new NotFoundError("Ordem de Serviço", workOrderId);

    if (!canOperateWorkOrder(actor.role, actor.id, workOrder.assignedUserId)) {
      throw new ForbiddenError("Você não pode alterar esta ordem de serviço.");
    }

    const allowedNext = VALID_TRANSITIONS[workOrder.status] ?? [];
    if (!allowedNext.includes(newStatus)) {
      throw new ConflictError(`Não é possível mover de ${workOrder.status} para ${newStatus}.`);
    }

    const now = new Date();
    const extra: Record<string, unknown> = {};
    if (newStatus === "IN_PROGRESS" && !workOrder.actualStart) extra.actualStart = now;
    if (newStatus === "COMPLETED") extra.actualEnd = now;

    const updated = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.update({
        where: { id: workOrderId },
        data: { status: newStatus as WorkOrderStatus, ...extra },
      });

      await tx.workOrderHistory.create({
        data: {
          workOrderId,
          userId: actor.id,
          action: "STATUS_CHANGE",
          previousStatus: workOrder.status,
          newStatus: newStatus as WorkOrderStatus,
          description: notes,
        },
      });

      return wo;
    });

    return updated;
  },
};
