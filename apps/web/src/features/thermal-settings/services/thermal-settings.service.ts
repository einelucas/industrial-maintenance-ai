import { prisma } from "@/lib/db/client";
import { thermalConfigRepository } from "@/features/thermal-settings/repositories/thermal-config.repository";
import {
  componentTypeThermalConfigSchema,
  globalThermalConfigSchema,
} from "@/features/thermal-settings/schemas/thermal-config.schema";
import { resolveEffectiveThermalConfig, type EffectiveThermalConfig } from "@/features/thermal-settings/services/thermal-config-resolver";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { ElectricalComponentType } from "@prisma/client";

export const thermalSettingsService = {
  getGlobal: () => thermalConfigRepository.findGlobal(),

  getAllComponentTypeConfigs: () => thermalConfigRepository.findAllComponentTypeConfigs(),

  async upsertGlobal(input: unknown, updatedById: string) {
    const parsed = globalThermalConfigSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Configuração térmica global inválida.", parsed.error.flatten().fieldErrors);
    }
    return thermalConfigRepository.upsertGlobal({ ...parsed.data, updatedById });
  },

  async upsertComponentType(input: unknown, updatedById: string) {
    const parsed = componentTypeThermalConfigSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Configuração térmica por tipo de componente inválida.", parsed.error.flatten().fieldErrors);
    }
    const { componentType, ...rest } = parsed.data;
    return thermalConfigRepository.upsertComponentTypeConfig(componentType, { ...rest, updatedById });
  },

  /**
   * Configuração efetiva de um ponto: resolve pela precedência única
   * (ponto -> tipo de componente -> global -> padrão) — sempre retorna os
   * quatro valores, mesmo sem nenhuma configuração cadastrada em nenhum
   * nível (cai no padrão versionado em código).
   */
  async resolveForPoint(thermalPointId: string): Promise<EffectiveThermalConfig> {
    const point = await prisma.thermalPoint.findUnique({
      where: { id: thermalPointId },
      include: { component: true },
    });
    if (!point) throw new NotFoundError("Ponto termográfico", thermalPointId);

    const [componentTypeConfig, globalConfig] = await Promise.all([
      thermalConfigRepository.findComponentTypeConfig(point.component.componentType as ElectricalComponentType),
      thermalConfigRepository.findGlobal(),
    ]);

    return resolveEffectiveThermalConfig(point, componentTypeConfig, globalConfig);
  },
};
