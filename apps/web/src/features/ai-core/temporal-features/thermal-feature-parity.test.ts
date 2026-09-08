import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calculateTemporalFeatures, THERMAL_FEATURE_VERSION } from "./calculate-temporal-features";

interface FixtureReading { measuredAt: string; temperatureMaxC: number; deltaTC: number; currentA: number; loadPercent: number; signalQuality: number }

describe("paridade Python/TypeScript das features térmicas", () => {
  it("reproduz o caso de referência compartilhado sem olhar para o futuro", () => {
    const fixturePath = path.resolve(__dirname, "../../../../../../services/predictive-ai/tests/fixtures/thermal_feature_reference.json");
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { attentionThresholdC: number; readings: FixtureReading[]; expected: Record<string, number | boolean> };
    const readings = fixture.readings.map((reading) => ({ ...reading, measuredAt: new Date(reading.measuredAt) }));
    const actual = calculateTemporalFeatures({ current: readings.at(-1)!, priorReadings: readings.slice(0, -1), attentionThresholdC: fixture.attentionThresholdC });
    const expected = fixture.expected;
    expect(actual.featureVersion).toBe(THERMAL_FEATURE_VERSION);
    expect(actual.mean5mC).toEqual({ value: expected.mean5mC, sampleCount: expected.mean5mSampleCount });
    expect(actual.mean15mC).toEqual({ value: expected.mean15mC, sampleCount: expected.mean15mSampleCount });
    expect(actual.mean60mC).toEqual({ value: expected.mean60mC, sampleCount: expected.mean60mSampleCount });
    expect(actual.max1hC.value).toBe(expected.max1hC); expect(actual.max6hC.value).toBe(expected.max6hC); expect(actual.max24hC.value).toBe(expected.max24hC);
    expect(actual.trendCPerHour).toBeCloseTo(expected.trendCPerHour as number, 10);
    expect(actual.trendSampleCount).toBe(expected.trendSampleCount);
    expect(actual.timeAboveLimitMin).toBe(expected.timeAboveLimitMin);
    expect(actual.consecutiveAnomalousCount).toBe(expected.consecutiveAnomalousCount);
    expect(actual.minutesSinceLastValidReading).toBe(expected.minutesSinceLastValidReading);
    expect(actual.baseline.meanC).toBe(expected.baselineMeanC);
    expect(actual.baseline.stdDevC).toBeCloseTo(expected.baselineStdDevC as number, 10);
    expect(actual.baseline.sampleCount).toBe(expected.baselineSampleCount);
    expect(actual.avgLoadPercent).toBe(expected.avgLoadPercent); expect(actual.avgCurrentA).toBe(expected.avgCurrentA);
    expect(actual.aggregatedSignalQuality).toBeCloseTo(expected.aggregatedSignalQuality as number, 10);
    expect(actual.totalHistorySampleCount).toBe(expected.totalHistorySampleCount);
    expect(actual.sufficientForInference).toBe(expected.sufficientForInference);
  });
});
