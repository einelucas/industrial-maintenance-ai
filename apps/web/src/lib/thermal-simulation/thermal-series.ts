import type { ThermalCause } from "@prisma/client";
import { createRng, hashSeed, rngNoise, type Rng } from "./rng";
import type { PointBlueprint } from "./plant-blueprint";

// Ancoragem temporal fixa (não usa Date.now()) — garante que duas execuções
// limpas do seed produzam exatamente os mesmos timestamps.
export const DEMO_SCENARIO_END = new Date("2026-09-03T06:00:00.000Z");
export const DURATION_DAYS = 5;
export const SAMPLE_INTERVAL_MINUTES = 60;
export const SAMPLES_PER_POINT = (DURATION_DAYS * 24 * 60) / SAMPLE_INTERVAL_MINUTES;
export const POST_ACTION_SAMPLES = 12;

export interface SimulatedReading {
  measuredAt: Date;
  sequence: number;
  temperatureMaxC: number;
  temperatureAverageC: number;
  ambientTemperatureC: number;
  referenceTemperatureC: number;
  deltaTC: number;
  currentA: number;
  loadPercent: number;
  emissivity: number;
  signalQuality: number;
}

export interface PointSeries {
  code: string;
  /** Série pré-ação — a única persistida no banco pelo seed. */
  persisted: SimulatedReading[];
  /**
   * Série de normalização pós-intervenção — existe apenas no ponto crítico
   * oficial e apenas no manifesto de ground truth. Nunca é persistida pelo
   * seed nem lida pelo runtime; será liberada por uma etapa futura, somente
   * após a conclusão de uma OS.
   */
  reservedPostAction?: SimulatedReading[];
}

interface AnomalyProfile {
  finalDeltaTRange: [number, number];
  shape: "accelerating" | "linear" | "plateau" | "oscillating";
}

const ANOMALY_PROFILES: Record<ThermalCause, AnomalyProfile> = {
  LOOSE_CONNECTION: { finalDeltaTRange: [30, 36], shape: "accelerating" },
  CONTACT_RESISTANCE: { finalDeltaTRange: [16, 22], shape: "accelerating" },
  OVERLOAD: { finalDeltaTRange: [14, 20], shape: "oscillating" },
  PHASE_IMBALANCE: { finalDeltaTRange: [11, 16], shape: "plateau" },
  DEGRADED_CONTACT: { finalDeltaTRange: [13, 18], shape: "linear" },
  INSUFFICIENT_VENTILATION: { finalDeltaTRange: [9, 14], shape: "plateau" },
  THERMAL_RELAY_DEGRADATION: { finalDeltaTRange: [15, 20], shape: "oscillating" },
  PROCESS_CONDITION: { finalDeltaTRange: [8, 12], shape: "linear" },
  SENSOR_ERROR: { finalDeltaTRange: [0, 0], shape: "linear" },
  NOT_CONFIRMED: { finalDeltaTRange: [0, 0], shape: "linear" },
  OTHER: { finalDeltaTRange: [10, 15], shape: "linear" },
};

function shapeFn(shape: AnomalyProfile["shape"], progress: number): number {
  switch (shape) {
    case "accelerating":
      return Math.pow(progress, 1.6);
    case "plateau":
      return 1 - Math.exp(-3 * progress);
    case "oscillating":
      return progress + 0.15 * Math.sin(progress * 6 * Math.PI) * progress;
    case "linear":
    default:
      return progress;
  }
}

function ambientTemperatureC(hourOfDay: number, dayIndex: number, rng: Rng): number {
  const base = 26;
  const diurnal = Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI) * 2.5;
  const drift = Math.sin((dayIndex / DURATION_DAYS) * Math.PI) * 1.2;
  return base + diurnal + drift + rngNoise(rng) * 0.6;
}

function loadPercent(hourOfDay: number, rng: Rng): number {
  const isProductionShift = hourOfDay >= 6 && hourOfDay < 22;
  const base = isProductionShift ? 70 : 25;
  const value = base + rngNoise(rng) * 8;
  return Math.min(100, Math.max(5, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Gera a série temporal de um ponto termográfico de forma puramente
 * determinística. O seed de série é derivado de `seriesSeed` + código do
 * ponto (nunca de `Math.random()` ou `Date.now()`).
 */
export function generatePointSeries(point: PointBlueprint, seriesSeed: number): PointSeries {
  const rng = createRng(hashSeed(seriesSeed, point.code));
  const profile = ANOMALY_PROFILES[point.cause];
  const severityRng = createRng(hashSeed(seriesSeed, `${point.code}-severity`));
  const finalDeltaTTarget =
    profile.finalDeltaTRange[0] + severityRng() * (profile.finalDeltaTRange[1] - profile.finalDeltaTRange[0]);

  const persisted: SimulatedReading[] = [];

  for (let i = 0; i < SAMPLES_PER_POINT; i++) {
    const minutesFromStart = i * SAMPLE_INTERVAL_MINUTES;
    const measuredAt = new Date(
      DEMO_SCENARIO_END.getTime() - (SAMPLES_PER_POINT - 1 - i) * SAMPLE_INTERVAL_MINUTES * 60_000
    );
    const hourOfDay = measuredAt.getUTCHours();
    const dayIndex = Math.floor(minutesFromStart / (24 * 60));

    const ambient = ambientTemperatureC(hourOfDay, dayIndex, rng);
    const load = loadPercent(hourOfDay, rng);
    const currentA = round1(point.ratedCurrent * (load / 100) * (1 + rngNoise(rng) * 0.04));

    const loadHeatingC = point.componentBaselineRiseC * (load / 100);

    const progress = point.initiallyAnomalous ? i / (SAMPLES_PER_POINT - 1) : 0;
    const degradationC = point.initiallyAnomalous ? finalDeltaTTarget * shapeFn(profile.shape, progress) : 0;

    const sensorNoiseC = rngNoise(rng) * 0.5;

    let temperatureMaxC = round1(ambient + loadHeatingC + degradationC + sensorNoiseC);
    let referenceTemperatureC = point.referenceTemperatureC;

    const isLastSample = i === SAMPLES_PER_POINT - 1;
    if (point.isOfficialCriticalCase && isLastSample) {
      // Pico oficial do desafio GPMS 2026 — fixado ao valor exato, no fim de
      // uma evolução plausível (não é uma linha isolada).
      temperatureMaxC = 75.6;
      referenceTemperatureC = 40.0;
    }

    const deltaTC = round1(temperatureMaxC - referenceTemperatureC);
    const temperatureAverageC = round1(temperatureMaxC - (0.6 + rng() * 0.8));
    const emissivity = round1(0.92 + rngNoise(rng) * 0.01);
    const signalQuality = Math.min(0.99, Math.max(0.9, round1(0.97 + rngNoise(rng) * 0.02)));

    persisted.push({
      measuredAt,
      sequence: i + 1,
      temperatureMaxC,
      temperatureAverageC,
      ambientTemperatureC: round1(ambient),
      referenceTemperatureC,
      deltaTC,
      currentA,
      loadPercent: round1(load),
      emissivity,
      signalQuality,
    });
  }

  if (!point.isOfficialCriticalCase) {
    return { code: point.code, persisted };
  }

  // Série de normalização reservada — somente no manifesto, nunca persistida
  // pelo seed. Representa a fase pós-intervenção que só deverá ser liberada
  // depois da conclusão futura de uma OS (Etapa 10).
  const postRng = createRng(hashSeed(seriesSeed, `${point.code}-post-action`));
  const lastPersisted = persisted[persisted.length - 1]!;
  const reservedPostAction: SimulatedReading[] = [];
  for (let i = 1; i <= POST_ACTION_SAMPLES; i++) {
    const measuredAt = new Date(lastPersisted.measuredAt.getTime() + i * SAMPLE_INTERVAL_MINUTES * 60_000);
    const hourOfDay = measuredAt.getUTCHours();
    const cooldownProgress = i / POST_ACTION_SAMPLES;
    const ambient = ambientTemperatureC(hourOfDay, DURATION_DAYS, postRng);
    const load = loadPercent(hourOfDay, postRng);
    const residualDeltaT = finalDeltaTTarget * Math.exp(-3.5 * cooldownProgress);
    const loadHeatingC = point.componentBaselineRiseC * (load / 100);
    const temperatureMaxC = round1(ambient + loadHeatingC + residualDeltaT + rngNoise(postRng) * 0.4);
    const referenceTemperatureC = point.referenceTemperatureC;

    reservedPostAction.push({
      measuredAt,
      sequence: lastPersisted.sequence + i,
      temperatureMaxC,
      temperatureAverageC: round1(temperatureMaxC - (0.6 + postRng() * 0.8)),
      ambientTemperatureC: round1(ambient),
      referenceTemperatureC,
      deltaTC: round1(temperatureMaxC - referenceTemperatureC),
      currentA: round1(point.ratedCurrent * (load / 100)),
      loadPercent: round1(load),
      emissivity: round1(0.92 + rngNoise(postRng) * 0.01),
      signalQuality: 0.98,
    });
  }

  return { code: point.code, persisted, reservedPostAction };
}
