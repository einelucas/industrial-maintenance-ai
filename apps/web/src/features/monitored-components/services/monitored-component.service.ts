import { prisma } from "@/lib/db/client";
import {
  monitoredComponentRepository,
  type MonitoredComponentFilters,
} from "@/features/monitored-components/repositories/monitored-component.repository";
import {
  monitoredComponentSchema,
  type MonitoredComponentInput,
} from "@/features/monitored-components/schemas/monitored-component.schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

async function assertPanelActive(panelId: string) {
  const panel = await prisma.electricalPanel.findUnique({ where: { id: panelId } });
  if (!panel) throw new ValidationError("Painel não encontrado.", { panelId: ["Painel inválido."] });
  if (!panel.active) {
    throw new ValidationError("Não é possível vincular um componente ativo a um painel inativo.", {
      panelId: ["Painel inativo."],
    });
  }
  return panel;
}

function parseInput(input: unknown): MonitoredComponentInput {
  const parsed = monitoredComponentSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Dados do componente inválidos.", parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

export const monitoredComponentService = {
  listActive: () => monitoredComponentRepository.findAllActive(),

  listFiltered: (filters: MonitoredComponentFilters) => monitoredComponentRepository.findFiltered(filters),

  async getOrThrow(id: string) {
    const component = await monitoredComponentRepository.findById(id);
    if (!component) throw new NotFoundError("Componente monitorado", id);
    return component;
  },

  async create(input: unknown) {
    const data = parseInput(input);

    const existing = await monitoredComponentRepository.findByTag(data.tag);
    if (existing) throw new ConflictError(`Já existe um componente com a TAG "${data.tag}".`);

    await assertPanelActive(data.panelId);

    return monitoredComponentRepository.create({
      tag: data.tag,
      name: data.name,
      componentType: data.componentType,
      phase: data.phase || null,
      ratedCurrent: data.ratedCurrent,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      panelId: data.panelId,
    });
  },

  async update(id: string, input: unknown) {
    const data = parseInput(input);
    await this.getOrThrow(id);

    const existing = await monitoredComponentRepository.findByTag(data.tag);
    if (existing && existing.id !== id) {
      throw new ConflictError(`Já existe um componente com a TAG "${data.tag}".`);
    }

    await assertPanelActive(data.panelId);

    return monitoredComponentRepository.update(id, {
      tag: data.tag,
      name: data.name,
      componentType: data.componentType,
      phase: data.phase || null,
      ratedCurrent: data.ratedCurrent,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      panelId: data.panelId,
    });
  },

  /** Preferimos inativação a exclusão física — bloqueia se houver ThermalPoint ativo. */
  async deactivate(id: string) {
    await this.getOrThrow(id);
    const activePoints = await monitoredComponentRepository.countActivePoints(id);
    if (activePoints > 0) {
      throw new ConflictError(
        `Não é possível inativar: ${activePoints} ponto(s) termográfico(s) ativo(s) neste componente. Inative-os primeiro.`
      );
    }
    return monitoredComponentRepository.update(id, { active: false });
  },

  async reactivate(id: string) {
    await this.getOrThrow(id);
    return monitoredComponentRepository.update(id, { active: true });
  },
};
