import { buildPlantBlueprint, type PlantBlueprint } from "./plant-blueprint";
import { generatePointSeries, type PointSeries } from "./thermal-series";

// Seeds fixos e documentados — separados propositalmente: a identidade da
// planta (setores/pontos/quais 19 são anômalos) não depende da mesma
// sequência aleatória usada para gerar ruído nas séries temporais. Ambos são
// distintos dos seeds/períodos que serão usados no treino real (Etapa 7).
export const DEMO_IDENTITY_SEED = 20260903;
export const DEMO_SERIES_SEED = 356194;
export const DEMO_SCENARIO_VERSION = "gpms2026-demo-scenario-v1";

export interface DemoScenario {
  blueprint: PlantBlueprint;
  seriesByPointCode: Map<string, PointSeries>;
}

/**
 * Monta o cenário demonstrativo completo (estrutura da planta + séries
 * térmicas) de forma 100% determinística e sem I/O. Chamar duas vezes com os
 * mesmos seeds produz um resultado profundamente idêntico.
 */
export function buildDemoScenario(
  identitySeed = DEMO_IDENTITY_SEED,
  seriesSeed = DEMO_SERIES_SEED
): DemoScenario {
  const blueprint = buildPlantBlueprint(identitySeed);
  const seriesByPointCode = new Map<string, PointSeries>();
  for (const point of blueprint.points) {
    seriesByPointCode.set(point.code, generatePointSeries(point, seriesSeed));
  }
  return { blueprint, seriesByPointCode };
}

export interface ReservedScenarioManifest {
  manifestVersion: string;
  scenarioVersion: string;
  generatedFrom: {
    identitySeed: number;
    seriesSeed: number;
  };
  period: {
    startAt: string;
    endAt: string;
    sampleIntervalMinutes: number;
  };
  note: string;
  trainingUsage: string;
  totalPoints: number;
  initiallyAnomalousCount: number;
  officialCriticalCase: {
    pointCode: string;
    cause: string;
    peak: { temperatureMaxC: number; referenceTemperatureC: number; deltaTC: number; measuredAt: string };
    reservedPostAction: {
      note: string;
      readings: Array<{ measuredAt: string; temperatureMaxC: number; referenceTemperatureC: number; deltaTC: number }>;
    };
  };
  points: Array<{
    code: string;
    componentTag: string;
    initiallyAnomalous: boolean;
    cause: string;
    isOfficialCriticalCase: boolean;
  }>;
}

/**
 * Constrói o manifesto de ground truth do cenário — usado apenas para
 * avaliação/validação futura do modelo. Nunca é importado pelo runtime da
 * aplicação (services/actions/components) nem usado para decidir estado
 * operacional.
 */
export function buildReservedScenarioManifest(scenario: DemoScenario): ReservedScenarioManifest {
  const { blueprint, seriesByPointCode } = scenario;
  const criticalPoint = blueprint.points.find((p) => p.isOfficialCriticalCase);
  if (!criticalPoint) {
    throw new Error("Cenário inconsistente: nenhum ponto marcado como caso crítico oficial.");
  }
  const criticalSeries = seriesByPointCode.get(criticalPoint.code);
  if (!criticalSeries) {
    throw new Error(`Cenário inconsistente: série ausente para o ponto crítico ${criticalPoint.code}.`);
  }
  const peakReading = criticalSeries.persisted[criticalSeries.persisted.length - 1]!;
  const reservedPostAction = criticalSeries.reservedPostAction ?? [];

  const anomalousCount = blueprint.points.filter((p) => p.initiallyAnomalous).length;

  return {
    manifestVersion: "1.0.0",
    scenarioVersion: DEMO_SCENARIO_VERSION,
    generatedFrom: { identitySeed: blueprint.identitySeed, seriesSeed: DEMO_SERIES_SEED },
    period: {
      startAt: criticalSeries.persisted[0]!.measuredAt.toISOString(),
      endAt: peakReading.measuredAt.toISOString(),
      sampleIntervalMinutes: 60,
    },
    note:
      "Ground truth do cenário demonstrativo reservado do GPMS 2026. Fica fora do caminho de " +
      "decisão do runtime: não é servido ao frontend, não é consultado pelos services da " +
      "aplicação e não define o estado atual dos pontos. `initiallyAnomalous` registra apenas " +
      "o fato histórico da inspeção original (19 de 55 pontos). O estado operacional atual só " +
      "pode nascer de uma inferência real da IA (etapas futuras).",
    trainingUsage:
      "Este cenário (seed de identidade, seed de série e período) é reservado para a demonstração " +
      "e não deve ser reutilizado no treino/validação/teste do modelo — que usarão seeds e " +
      "períodos distintos (Etapa 7), evitando memorização/vazamento.",
    totalPoints: blueprint.points.length,
    initiallyAnomalousCount: anomalousCount,
    officialCriticalCase: {
      pointCode: criticalPoint.code,
      cause: criticalPoint.cause,
      peak: {
        temperatureMaxC: peakReading.temperatureMaxC,
        referenceTemperatureC: peakReading.referenceTemperatureC,
        deltaTC: peakReading.deltaTC,
        measuredAt: peakReading.measuredAt.toISOString(),
      },
      reservedPostAction: {
        note:
          "Fase de normalização pós-intervenção. NÃO foi persistida no banco pelo seed. Só " +
          "deverá ser liberada/aplicada depois que uma OS futura para este ponto for concluída " +
          "(Etapa 10), para não antecipar ao runtime que a manutenção já ocorreu.",
        readings: reservedPostAction.map((r) => ({
          measuredAt: r.measuredAt.toISOString(),
          temperatureMaxC: r.temperatureMaxC,
          referenceTemperatureC: r.referenceTemperatureC,
          deltaTC: r.deltaTC,
        })),
      },
    },
    points: blueprint.points.map((p) => ({
      code: p.code,
      componentTag: p.componentTag,
      initiallyAnomalous: p.initiallyAnomalous,
      cause: p.cause,
      isOfficialCriticalCase: p.isOfficialCriticalCase,
    })),
  };
}
