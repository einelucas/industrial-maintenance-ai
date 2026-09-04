// Resolução de configuração térmica efetiva (GPMS 2026 / Etapa 3).
//
// Precedência única e centralizada:
//   ThermalPoint (override próprio) -> ThermalComponentTypeConfig ->
//   ThermalGlobalConfig -> padrão versionado em código (abaixo).
//
// Função pura — sem Prisma, sem I/O — para poder ser testada
// exaustivamente sem banco. `thermal-settings.service.ts` busca os dados e
// chama esta função. Os thresholds resolvidos aqui são apenas contexto de
// plausibilidade/engenharia: nunca criam Prediction, incidente ou alerta
// por si só (isso exige inferência real da IA, etapa futura).

export const DEFAULT_THERMAL_THRESHOLDS_VERSION = "thermal-settings-default-v1";

export const DEFAULT_THERMAL_THRESHOLDS = {
  absoluteLimitC: 90,
  deltaTAttentionC: 10,
  deltaTHighC: 20,
  deltaTCriticalC: 30,
} as const;

export type ThermalThresholdField = keyof typeof DEFAULT_THERMAL_THRESHOLDS;

export type ThermalThresholdSource = "POINT" | "COMPONENT_TYPE" | "GLOBAL" | "DEFAULT";

export type ThermalThresholdPartial = Partial<Record<ThermalThresholdField, number | null | undefined>>;

export interface EffectiveThermalConfig {
  values: Record<ThermalThresholdField, number>;
  sources: Record<ThermalThresholdField, ThermalThresholdSource>;
  defaultVersion: string;
}

const FIELDS: ThermalThresholdField[] = ["absoluteLimitC", "deltaTAttentionC", "deltaTHighC", "deltaTCriticalC"];

export function resolveEffectiveThermalConfig(
  point: ThermalThresholdPartial,
  componentTypeConfig: ThermalThresholdPartial | null | undefined,
  globalConfig: ThermalThresholdPartial | null | undefined
): EffectiveThermalConfig {
  const values = {} as Record<ThermalThresholdField, number>;
  const sources = {} as Record<ThermalThresholdField, ThermalThresholdSource>;

  for (const field of FIELDS) {
    const pointValue = point[field];
    const typeValue = componentTypeConfig?.[field];
    const globalValue = globalConfig?.[field];

    if (pointValue !== null && pointValue !== undefined) {
      values[field] = pointValue;
      sources[field] = "POINT";
    } else if (typeValue !== null && typeValue !== undefined) {
      values[field] = typeValue;
      sources[field] = "COMPONENT_TYPE";
    } else if (globalValue !== null && globalValue !== undefined) {
      values[field] = globalValue;
      sources[field] = "GLOBAL";
    } else {
      values[field] = DEFAULT_THERMAL_THRESHOLDS[field];
      sources[field] = "DEFAULT";
    }
  }

  return { values, sources, defaultVersion: DEFAULT_THERMAL_THRESHOLDS_VERSION };
}
