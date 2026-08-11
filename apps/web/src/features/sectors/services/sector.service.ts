import { sectorRepository } from "@/features/sectors/repositories/sector.repository";
import { sectorSchema, type SectorInput } from "@/features/sectors/schemas/sector.schema";
import { NotFoundError, ValidationError } from "@/lib/errors";

export const sectorService = {
  list: () => sectorRepository.findAllWithEquipmentCount(),

  async create(input: unknown) {
    const parsed = sectorSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados do setor inválidos.", parsed.error.flatten().fieldErrors);
    }
    return sectorRepository.create(parsed.data as SectorInput);
  },

  async getOrThrow(id: string) {
    const sector = await sectorRepository.findById(id);
    if (!sector) throw new NotFoundError("Setor", id);
    return sector;
  },
};
