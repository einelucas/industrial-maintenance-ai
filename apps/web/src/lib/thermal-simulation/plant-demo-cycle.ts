import { buildDemoScenario } from "@/lib/thermal-simulation/scenario";

export const PLANT_DEMO_SAMPLE_COUNT = 13;
export const PLANT_DEMO_INTERVAL_MINUTES = 30;

export interface PlantDemoMeasurement {
  thermalPointCode: string;
  measuredAt: Date;
  temperatureMaxC: number;
  temperatureAverageC: number;
  ambientTemperatureC: number;
  referenceTemperatureC: number;
  currentA: number;
  loadPercent: number;
  emissivity: number;
  signalQuality: number;
}

/**
 * Cria uma janela sincronizada da planta para demonstração. Os valores vêm
 * das séries físicas determinísticas; rótulo, causa e flag de anomalia não
 * fazem parte das medições devolvidas e nunca chegam ao modelo.
 */
export function buildPlantDemoCycle(endAt: Date) {
  const scenario = buildDemoScenario();
  const rows: PlantDemoMeasurement[] = [];

  for (const point of scenario.blueprint.points) {
    const source = scenario.seriesByPointCode.get(point.code)!.persisted;
    for (let sample = 0; sample < PLANT_DEMO_SAMPLE_COUNT; sample++) {
      const sourceIndex = Math.round((sample * (source.length - 1)) / (PLANT_DEMO_SAMPLE_COUNT - 1));
      const reading = source[sourceIndex]!;
      rows.push({
        thermalPointCode: point.code,
        measuredAt: new Date(endAt.getTime() - (PLANT_DEMO_SAMPLE_COUNT - 1 - sample) * PLANT_DEMO_INTERVAL_MINUTES * 60_000),
        temperatureMaxC: reading.temperatureMaxC,
        temperatureAverageC: reading.temperatureAverageC,
        ambientTemperatureC: reading.ambientTemperatureC,
        referenceTemperatureC: reading.referenceTemperatureC,
        currentA: reading.currentA,
        loadPercent: reading.loadPercent,
        emissivity: reading.emissivity,
        signalQuality: reading.signalQuality,
      });
    }
  }

  return {
    rows,
    pointCount: scenario.blueprint.points.length,
    expectedAnomalousPointCount: scenario.blueprint.points.filter((point) => point.initiallyAnomalous).length,
    officialCriticalPointCode: scenario.blueprint.officialCriticalPointCode,
    endAt,
  };
}
