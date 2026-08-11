import { equipmentRepository, type EquipmentFilters } from "@/features/equipments/repositories/equipment.repository";
import { equipmentSchema } from "@/features/equipments/schemas/equipment.schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const equipmentService = {
  list: () => equipmentRepository.findAll(),

  listFiltered: (filters: EquipmentFilters) => equipmentRepository.findFiltered(filters),

  async getOrThrow(id: string) {
    const equipment = await equipmentRepository.findById(id);
    if (!equipment) throw new NotFoundError("Equipamento", id);
    return equipment;
  },

  async create(input: unknown) {
    const parsed = equipmentSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados do equipamento inválidos.", parsed.error.flatten().fieldErrors);
    }

    const existing = await equipmentRepository.findByTag(parsed.data.tag);
    if (existing) {
      throw new ConflictError(`Já existe um equipamento com a TAG "${parsed.data.tag}".`);
    }

    return equipmentRepository.create(parsed.data);
  },

  async update(id: string, input: unknown) {
    const parsed = equipmentSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados do equipamento inválidos.", parsed.error.flatten().fieldErrors);
    }

    await this.getOrThrow(id);

    const existing = await equipmentRepository.findByTag(parsed.data.tag);
    if (existing && existing.id !== id) {
      throw new ConflictError(`Já existe um equipamento com a TAG "${parsed.data.tag}".`);
    }

    return equipmentRepository.update(id, parsed.data);
  },
};
