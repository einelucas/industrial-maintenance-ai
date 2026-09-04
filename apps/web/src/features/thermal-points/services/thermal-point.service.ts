import { prisma } from "@/lib/db/client";
import { thermalPointRepository, type ThermalPointFilters } from "@/features/thermal-points/repositories/thermal-point.repository";
import { thermalPointSchema, type ThermalPointInput } from "@/features/thermal-points/schemas/thermal-point.schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

async function assertComponentActive(componentId: string) {
  const component = await prisma.monitoredComponent.findUnique({ where: { id: componentId } });
  if (!component) throw new ValidationError("Componente não encontrado.", { componentId: ["Componente inválido."] });
  if (!component.active) {
    throw new ValidationError("Não é possível vincular um ponto ativo a um componente inativo.", {
      componentId: ["Componente inativo."],
    });
  }
  return component;
}

function parseInput(input: unknown): ThermalPointInput {
  const parsed = thermalPointSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Dados do ponto termográfico inválidos.", parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

export const thermalPointService = {
  listActive: () => thermalPointRepository.findAllActive(),

  listFiltered: (filters: ThermalPointFilters) => thermalPointRepository.findFiltered(filters),

  async getOrThrow(id: string) {
    const point = await thermalPointRepository.findById(id);
    if (!point) throw new NotFoundError("Ponto termográfico", id);
    return point;
  },

  countReadings: (id: string) => thermalPointRepository.countReadings(id),

  async create(input: unknown) {
    const data = parseInput(input);

    const existing = await thermalPointRepository.findByCode(data.code);
    if (existing) throw new ConflictError(`Já existe um ponto com o código "${data.code}".`);

    await assertComponentActive(data.componentId);

    return thermalPointRepository.create({
      code: data.code,
      name: data.name,
      componentId: data.componentId,
      monitoringMode: data.monitoringMode,
      emissivity: data.emissivity,
      referenceDescription: data.referenceDescription || null,
      absoluteLimitC: data.absoluteLimitC,
      deltaTAttentionC: data.deltaTAttentionC,
      deltaTHighC: data.deltaTHighC,
      deltaTCriticalC: data.deltaTCriticalC,
      sampleIntervalSec: data.sampleIntervalSec,
      // `initiallyAnomalous` nunca é aceito pela entrada pública — pontos
      // administrados por esta feature nascem sempre com o padrão `false`
      // do schema Prisma. Só o seed determinístico (Etapa 2) registra o
      // fato histórico da inspeção original.
    });
  },

  async update(id: string, input: unknown) {
    const data = parseInput(input);
    await this.getOrThrow(id);

    const existing = await thermalPointRepository.findByCode(data.code);
    if (existing && existing.id !== id) {
      throw new ConflictError(`Já existe um ponto com o código "${data.code}".`);
    }

    await assertComponentActive(data.componentId);

    return thermalPointRepository.update(id, {
      code: data.code,
      name: data.name,
      componentId: data.componentId,
      monitoringMode: data.monitoringMode,
      emissivity: data.emissivity,
      referenceDescription: data.referenceDescription || null,
      absoluteLimitC: data.absoluteLimitC,
      deltaTAttentionC: data.deltaTAttentionC,
      deltaTHighC: data.deltaTHighC,
      deltaTCriticalC: data.deltaTCriticalC,
      sampleIntervalSec: data.sampleIntervalSec,
    });
  },

  /**
   * Inativa sem apagar leituras/histórico — as 6.600 leituras persistidas na
   * Etapa 2 nunca são desconectadas ou removidas por esta ação.
   */
  async deactivate(id: string) {
    await this.getOrThrow(id);
    return thermalPointRepository.update(id, { active: false });
  },

  async reactivate(id: string) {
    await this.getOrThrow(id);
    return thermalPointRepository.update(id, { active: true });
  },
};
