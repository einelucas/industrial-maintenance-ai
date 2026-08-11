import { prisma } from "@/lib/db/client";
import { maintenancePlanRepository, type MaintenancePlanFilters } from "@/features/maintenance-plans/repositories/maintenance-plan.repository";
import { maintenancePlanSchema, maintenancePlanUpdateSchema } from "@/features/maintenance-plans/schemas/maintenance-plan.schema";
import { generateWorkOrderNumber } from "@/features/work-orders/services/work-order-number.service";
import { computeNextExecution } from "@/lib/dates/next-execution";
import { SYSTEM_USER_EMAIL } from "@/lib/constants";
import { NotFoundError, ValidationError } from "@/lib/errors";

export const maintenancePlanService = {
  list: () => maintenancePlanRepository.findAll(),

  listFiltered: (filters: MaintenancePlanFilters) => maintenancePlanRepository.findFiltered(filters),

  async getOrThrow(id: string) {
    const plan = await maintenancePlanRepository.findById(id);
    if (!plan) throw new NotFoundError("Plano preventivo", id);
    return plan;
  },

  async create(input: unknown) {
    const parsed = maintenancePlanSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados do plano preventivo inválidos.", parsed.error.flatten().fieldErrors);
    }
    const data = parsed.data;

    return maintenancePlanRepository.create({
      name: data.name,
      description: data.description,
      equipment: { connect: { id: data.equipmentId } },
      frequencyType: data.frequencyType,
      frequencyValue: data.frequencyValue,
      nextExecution: new Date(data.nextExecution),
      estimatedHours: data.estimatedHours,
      defaultAssignee: data.defaultAssigneeId ? { connect: { id: data.defaultAssigneeId } } : undefined,
      checklistItems: data.checklistItems?.length
        ? { create: data.checklistItems.map((description, order) => ({ description, order })) }
        : undefined,
    });
  },

  async update(id: string, input: unknown) {
    const parsed = maintenancePlanUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados do plano preventivo inválidos.", parsed.error.flatten().fieldErrors);
    }
    const data = parsed.data;

    await this.getOrThrow(id);

    // Checklist é só um "molde": a OS gerada sempre leva uma cópia congelada
    // (WorkOrderChecklistItem), então apagar e recriar aqui não afeta OS já
    // geradas — mais simples do que tentar dar diff item a item.
    return maintenancePlanRepository.update(id, {
      name: data.name,
      description: data.description,
      frequencyType: data.frequencyType,
      frequencyValue: data.frequencyValue,
      nextExecution: new Date(data.nextExecution),
      estimatedHours: data.estimatedHours,
      defaultAssignee: data.defaultAssigneeId ? { connect: { id: data.defaultAssigneeId } } : { disconnect: true },
      checklistItems: {
        deleteMany: {},
        create: (data.checklistItems ?? []).map((description, order) => ({ description, order })),
      },
    });
  },

  /**
   * "Gerar ordem de serviço" manual (seção 18): cria uma WorkOrder PREVENTIVE
   * a partir do plano, copiando o checklist (cópia congelada, seção 17).
   */
  async generateWorkOrder(planId: string, createdById: string) {
    const plan = await maintenancePlanRepository.findById(planId);
    if (!plan) throw new NotFoundError("Plano preventivo", planId);

    const number = await generateWorkOrderNumber();

    return prisma.workOrder.create({
      data: {
        number,
        title: `Preventiva: ${plan.name}`,
        description: plan.description,
        type: "PREVENTIVE",
        priority: "MEDIUM",
        status: "OPEN",
        equipment: { connect: { id: plan.equipmentId } },
        createdBy: { connect: { id: createdById } },
        assignedUser: plan.defaultAssigneeId ? { connect: { id: plan.defaultAssigneeId } } : undefined,
        estimatedHours: plan.estimatedHours,
        checklistItems: {
          create: plan.checklistItems.map((item) => ({
            description: item.description,
            order: item.order,
          })),
        },
        history: {
          create: {
            userId: createdById,
            action: "CREATED",
            newStatus: "OPEN",
            description: `OS gerada a partir do plano preventivo "${plan.name}".`,
          },
        },
      },
    });
  },

  /**
   * Scheduler automático (cron): para cada plano ativo vencido, gera a OS
   * preventiva e avança `nextExecution` na mesma transação — evita duplicar
   * a OS caso o job rode mais de uma vez antes do próximo ciclo (seção 18).
   * Planos são processados sequencialmente (não em paralelo) porque
   * `generateWorkOrderNumber()` não é seguro sob concorrência.
   */
  async runScheduledGeneration(now: Date = new Date()) {
    const systemUser = await prisma.user.findUnique({ where: { email: SYSTEM_USER_EMAIL } });
    if (!systemUser) {
      throw new NotFoundError("Usuário de sistema (rode `pnpm prisma:seed`)", SYSTEM_USER_EMAIL);
    }

    const duePlans = await maintenancePlanRepository.findDue(now);
    const generated: { planId: string; workOrderId: string; workOrderNumber: string }[] = [];

    for (const plan of duePlans) {
      const number = await generateWorkOrderNumber();
      const nextExecution = computeNextExecution(plan.nextExecution, plan.frequencyType, plan.frequencyValue);

      const [workOrder] = await prisma.$transaction([
        prisma.workOrder.create({
          data: {
            number,
            title: `Preventiva: ${plan.name}`,
            description: plan.description,
            type: "PREVENTIVE",
            priority: "MEDIUM",
            status: "OPEN",
            equipment: { connect: { id: plan.equipmentId } },
            createdBy: { connect: { id: systemUser.id } },
            assignedUser: plan.defaultAssigneeId ? { connect: { id: plan.defaultAssigneeId } } : undefined,
            estimatedHours: plan.estimatedHours,
            checklistItems: {
              create: plan.checklistItems.map((item) => ({ description: item.description, order: item.order })),
            },
            history: {
              create: {
                userId: systemUser.id,
                action: "CREATED",
                newStatus: "OPEN",
                description: `OS gerada automaticamente pelo agendador a partir do plano preventivo "${plan.name}".`,
              },
            },
          },
        }),
        prisma.maintenancePlan.update({ where: { id: plan.id }, data: { nextExecution } }),
      ]);

      generated.push({ planId: plan.id, workOrderId: workOrder.id, workOrderNumber: workOrder.number });
    }

    return generated;
  },
};
