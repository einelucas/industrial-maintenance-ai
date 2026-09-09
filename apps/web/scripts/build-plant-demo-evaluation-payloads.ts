import { buildPlantDemoCycle } from "../src/lib/thermal-simulation/plant-demo-cycle";
import { buildDemoScenario } from "../src/lib/thermal-simulation/scenario";
import { calculateTemporalFeatures } from "../src/features/ai-core/temporal-features/calculate-temporal-features";

const endAt = new Date("2026-09-09T12:00:00.000Z");
const cycle = buildPlantDemoCycle(endAt);
const scenario = buildDemoScenario();
const componentByTag = new Map(scenario.blueprint.components.map((component) => [component.tag, component]));

const output = scenario.blueprint.points.map((point) => {
  const rows = cycle.rows
    .filter((row) => row.thermalPointCode === point.code)
    .sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
  const current = rows.at(-1)!;
  const prior = rows.slice(0, -1);
  const asFeature = (row: typeof current) => ({ ...row, deltaTC: row.temperatureMaxC - row.referenceTemperatureC });
  const features = calculateTemporalFeatures({
    current: asFeature(current),
    priorReadings: prior.map(asFeature),
    attentionThresholdC: point.deltaTAttentionC,
  });
  const number = Number(point.code.slice(3));
  const uuid = `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

  return {
    code: point.code,
    expected: point.initiallyAnomalous,
    payload: {
      inferenceRequestId: `evaluation-${point.code}`,
      thermalReadingId: uuid,
      thermalPointId: uuid,
      componentType: componentByTag.get(point.componentTag)!.componentType,
      featureVersion: features.featureVersion,
      current: {
        temperatureMaxC: current.temperatureMaxC,
        temperatureAverageC: current.temperatureAverageC,
        ambientTemperatureC: current.ambientTemperatureC,
        referenceTemperatureC: current.referenceTemperatureC,
        deltaTC: current.temperatureMaxC - current.referenceTemperatureC,
        currentA: current.currentA,
        loadPercent: current.loadPercent,
        signalQuality: current.signalQuality,
        measuredAt: current.measuredAt.toISOString(),
      },
      window: {
        mean5mC: features.mean5mC.value, mean5mSampleCount: features.mean5mC.sampleCount,
        mean15mC: features.mean15mC.value, mean15mSampleCount: features.mean15mC.sampleCount,
        mean60mC: features.mean60mC.value, mean60mSampleCount: features.mean60mC.sampleCount,
        max1hC: features.max1hC.value, max6hC: features.max6hC.value, max24hC: features.max24hC.value,
        trendCPerHour: features.trendCPerHour, trendSampleCount: features.trendSampleCount,
        timeAboveLimitMin: features.timeAboveLimitMin,
        consecutiveAnomalousCount: features.consecutiveAnomalousCount,
        minutesSinceLastValidReading: features.minutesSinceLastValidReading,
      },
      baseline: {
        meanC: features.baseline.meanC, stdDevC: features.baseline.stdDevC,
        sampleCount: features.baseline.sampleCount, sufficient: features.baseline.sufficient,
        avgLoadPercent: features.avgLoadPercent, avgCurrentA: features.avgCurrentA,
      },
      thresholds: {
        absoluteLimitC: point.absoluteLimitC, attentionDeltaTC: point.deltaTAttentionC,
        highDeltaTC: point.deltaTHighC, criticalDeltaTC: point.deltaTCriticalC,
      },
      quality: {
        sufficientForInference: features.sufficientForInference,
        totalHistorySampleCount: features.totalHistorySampleCount,
        aggregatedSignalQuality: features.aggregatedSignalQuality,
      },
    },
  };
});

process.stdout.write(JSON.stringify(output));
