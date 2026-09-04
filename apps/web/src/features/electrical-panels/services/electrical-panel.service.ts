import { prisma } from "@/lib/db/client";
import {
  electricalPanelRepository,
  type ElectricalPanelFilters,
} from "@/features/electrical-panels/repositories/electrical-panel.repository";
import { electricalPanelSchema, type ElectricalPanelInput } from "@/features/electrical-panels/schemas/electrical-panel.schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

async function assertSectorExists(sectorId: string) {
  const sector = await prisma.sector.findUnique({ where: { id: sectorId } });
  if (!sector) throw new ValidationError("Setor não encontrado.", { sectorId: ["Setor inválido."] });
  return sector;
}

/** Retorna o id normalizado (null quando vazio) e valida existência/atividade/setor do equipamento. */
async function resolveEquipmentId(equipmentId: string | undefined, sectorId: string) {
  if (!equipmentId) return null;

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) {
    throw new ValidationError("Equipamento não encontrado.", { equipmentId: ["Equipamento inválido."] });
  }
  if (equipment.status === "INACTIVE") {
    throw new ValidationError("Equipamento inativo não pode receber novos painéis.", {
      equipmentId: ["Equipamento inativo."],
    });
  }
  if (equipment.sectorId !== sectorId) {
    throw new ValidationError("O equipamento selecionado pertence a outro setor.", {
      equipmentId: ["Equipamento de outro setor."],
    });
  }
  return equipmentId;
}

function parseInput(input: unknown): ElectricalPanelInput {
  const parsed = electricalPanelSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Dados do painel elétrico inválidos.", parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

export const electricalPanelService = {
  listActive: () => electricalPanelRepository.findAllActive(),

  listFiltered: (filters: ElectricalPanelFilters) => electricalPanelRepository.findFiltered(filters),

  async getOrThrow(id: string) {
    const panel = await electricalPanelRepository.findById(id);
    if (!panel) throw new NotFoundError("Painel elétrico", id);
    return panel;
  },

  async create(input: unknown) {
    const data = parseInput(input);

    const existing = await electricalPanelRepository.findByTag(data.tag);
    if (existing) throw new ConflictError(`Já existe um painel com a TAG "${data.tag}".`);

    await assertSectorExists(data.sectorId);
    const equipmentId = await resolveEquipmentId(data.equipmentId, data.sectorId);

    return electricalPanelRepository.create({
      tag: data.tag,
      name: data.name,
      description: data.description || null,
      location: data.location || null,
      panelType: data.panelType,
      sectorId: data.sectorId,
      equipmentId,
    });
  },

  async update(id: string, input: unknown) {
    const data = parseInput(input);
    const current = await this.getOrThrow(id);

    const existing = await electricalPanelRepository.findByTag(data.tag);
    if (existing && existing.id !== id) {
      throw new ConflictError(`Já existe um painel com a TAG "${data.tag}".`);
    }

    await assertSectorExists(data.sectorId);
    const equipmentId = await resolveEquipmentId(data.equipmentId, data.sectorId);

    const sectorChanged = current.sectorId !== data.sectorId;
    const equipmentChanged = current.equipmentId !== equipmentId;

    const updated = await electricalPanelRepository.update(id, {
      tag: data.tag,
      name: data.name,
      description: data.description || null,
      location: data.location || null,
      panelType: data.panelType,
      sectorId: data.sectorId,
      equipmentId,
    });

    return { updated, sectorChanged, equipmentChanged };
  },

  /**
   * Preferimos inativação a exclusão física (histórico/relacionamentos
   * nunca são apagados nesta etapa). Bloqueia se ainda houver componente
   * ativo — evita "componente ativo em painel inativo" silenciosamente.
   */
  async deactivate(id: string) {
    await this.getOrThrow(id);
    const activeComponents = await electricalPanelRepository.countActiveComponents(id);
    if (activeComponents > 0) {
      throw new ConflictError(
        `Não é possível inativar: ${activeComponents} componente(s) ativo(s) neste painel. Inative-os primeiro.`
      );
    }
    return electricalPanelRepository.update(id, { active: false });
  },

  async reactivate(id: string) {
    await this.getOrThrow(id);
    return electricalPanelRepository.update(id, { active: true });
  },
};
