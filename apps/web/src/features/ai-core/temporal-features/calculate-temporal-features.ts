// Features temporais rastreáveis (GPMS 2026 / Etapa 5) — módulo puro, sem
// Prisma, sem I/O. Recebe a leitura sendo analisada e seu histórico anterior
// já filtrado pelo chamador, devolve as features que o gateway de IA vai
// enviar ao modelo. Nunca decide risco, causa ou severidade — só descreve o
// comportamento temporal da série, de forma rastreável e versionada.
//
// Regra de ouro contra vazamento: para uma leitura em `measuredAt = T`, só
// `priorReadings` com `measuredAt < T` (mais a própria leitura `current`, em
// `measuredAt = T`) podem influenciar o resultado. Este módulo nunca lê
// `initiallyAnomalous`, manifesto de ground truth, causa verdadeira do
// simulador ou qualquer leitura futura — ele nem recebe esses dados como
// parâmetro, então não existe "esquecer de não usar".

export const THERMAL_FEATURE_VERSION = "thermal-features-v1";

const MIN_BASELINE_SAMPLES = 10;
const MIN_TREND_SAMPLES = 2;
/** Um "furo" na série maior que isto não conta integralmente como "tempo acima do limite" — evita uma leitura antiga isolada inflar o tempo indefinidamente. */
const MAX_GAP_MINUTES_FOR_TIME_ABOVE_LIMIT = 180;

export interface TemporalFeatureReading {
  measuredAt: Date;
  temperatureMaxC: number;
  deltaTC: number | null;
  currentA: number | null;
  loadPercent: number | null;
  signalQuality: number | null;
}

export interface WindowStat {
  /** null quando não há nenhuma amostra na janela — nunca 0 fabricado. */
  value: number | null;
  sampleCount: number;
}

export interface BaselineStat {
  meanC: number | null;
  stdDevC: number | null;
  sampleCount: number;
  /** false quando sampleCount < MIN_BASELINE_SAMPLES — consumidor decide se ainda assim usa. */
  sufficient: boolean;
}

export interface TemporalFeatures {
  featureVersion: string;
  cutoffAt: Date;
  mean5mC: WindowStat;
  mean15mC: WindowStat;
  mean60mC: WindowStat;
  max1hC: WindowStat;
  max6hC: WindowStat;
  max24hC: WindowStat;
  /** °C/h por regressão linear sobre a janela de 60 min. null se houver menos de 2 amostras nela. */
  trendCPerHour: number | null;
  trendSampleCount: number;
  /** minutos com deltaT acima do limite de atenção nas últimas 24h. null se o limite ou o deltaT não forem conhecidos o suficiente para calcular. */
  timeAboveLimitMin: number | null;
  /** leituras mais recentes consecutivas (voltando a partir de T) com deltaT acima do limite. */
  consecutiveAnomalousCount: number;
  /** minutos desde a leitura anterior válida. null se `current` for a única leitura conhecida. */
  minutesSinceLastValidReading: number | null;
  baseline: BaselineStat;
  currentLoadPercent: number | null;
  avgLoadPercent: number | null;
  loadSampleCount: number;
  currentCurrentA: number | null;
  avgCurrentA: number | null;
  currentSampleCount: number;
  aggregatedSignalQuality: number | null;
  totalHistorySampleCount: number;
  /** false quando não há tendência (< 2 amostras/60min) ou baseline insuficiente — o gateway pode recusar a inferência com base nisto. */
  sufficientForInference: boolean;
}

function minutesBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 60_000;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[], avg: number): number | null {
  if (values.length < 2) return null;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function windowStat(readings: TemporalFeatureReading[], cutoffAt: Date, minutes: number, pick: (r: TemporalFeatureReading) => number | null, agg: "mean" | "max"): WindowStat {
  const from = cutoffAt.getTime() - minutes * 60_000;
  const values = readings
    .filter((r) => r.measuredAt.getTime() > from && r.measuredAt.getTime() <= cutoffAt.getTime())
    .map(pick)
    .filter((v): v is number => v !== null);

  if (values.length === 0) return { value: null, sampleCount: 0 };
  const value = agg === "mean" ? mean(values)! : Math.max(...values);
  return { value, sampleCount: values.length };
}

/** Regressão linear simples (mínimos quadrados) de y sobre x, devolve a inclinação (unidade de y por unidade de x). */
function linearRegressionSlope(points: { x: number; y: number }[]): number | null {
  if (points.length < MIN_TREND_SAMPLES) return null;
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null; // todos os pontos no mesmo instante — sem variação em x
  return (n * sumXY - sumX * sumY) / denominator;
}

export interface CalculateTemporalFeaturesParams {
  current: TemporalFeatureReading;
  /** Leituras com measuredAt < current.measuredAt, em qualquer ordem — a função ordena. Já deve vir filtrada pelo chamador a uma janela razoável (ex.: últimos 30 dias). */
  priorReadings: TemporalFeatureReading[];
  /** ΔT de atenção efetivo do ponto (resolveEffectiveThermalConfig, Etapa 3) — null se não configurado. */
  attentionThresholdC: number | null;
}

export function calculateTemporalFeatures(params: CalculateTemporalFeaturesParams): TemporalFeatures {
  const { current, attentionThresholdC } = params;
  const cutoffAt = current.measuredAt;

  const history = [...params.priorReadings, current].sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
  const priorSorted = params.priorReadings
    .filter((r) => r.measuredAt.getTime() < cutoffAt.getTime())
    .sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());

  const pickTemp = (r: TemporalFeatureReading) => r.temperatureMaxC;

  const mean5mC = windowStat(history, cutoffAt, 5, pickTemp, "mean");
  const mean15mC = windowStat(history, cutoffAt, 15, pickTemp, "mean");
  const mean60mC = windowStat(history, cutoffAt, 60, pickTemp, "mean");
  const max1hC = windowStat(history, cutoffAt, 60, pickTemp, "max");
  const max6hC = windowStat(history, cutoffAt, 6 * 60, pickTemp, "max");
  const max24hC = windowStat(history, cutoffAt, 24 * 60, pickTemp, "max");

  // Tendência: regressão linear sobre a janela de 60 min (mesma janela de mean60m/max1h).
  const trendWindowStart = cutoffAt.getTime() - 60 * 60_000;
  const trendReadings = history.filter((r) => r.measuredAt.getTime() > trendWindowStart && r.measuredAt.getTime() <= cutoffAt.getTime());
  const trendPoints = trendReadings.map((r) => ({ x: minutesBetween(r.measuredAt, cutoffAt), y: r.temperatureMaxC }));
  const slopePerMinute = linearRegressionSlope(trendPoints);
  const trendCPerHour = slopePerMinute === null ? null : slopePerMinute * 60;

  // Tempo acima do limite / anomalias consecutivas — só avaliável quando deltaTC e o limite de atenção existem.
  let timeAboveLimitMin: number | null = null;
  let consecutiveAnomalousCount = 0;
  if (attentionThresholdC !== null) {
    const dayStart = cutoffAt.getTime() - 24 * 60 * 60_000;
    const dayReadings = history.filter((r) => r.measuredAt.getTime() > dayStart && r.measuredAt.getTime() <= cutoffAt.getTime() && r.deltaTC !== null);

    let minutesAbove = 0;
    for (let i = 0; i < dayReadings.length; i++) {
      const reading = dayReadings[i]!;
      if (reading.deltaTC! <= attentionThresholdC) continue;
      const next = dayReadings[i + 1];
      const intervalEnd = next ? next.measuredAt.getTime() : cutoffAt.getTime();
      const gapMinutes = Math.min((intervalEnd - reading.measuredAt.getTime()) / 60_000, MAX_GAP_MINUTES_FOR_TIME_ABOVE_LIMIT);
      minutesAbove += Math.max(0, gapMinutes);
    }
    timeAboveLimitMin = Math.round(minutesAbove * 10) / 10;

    for (let i = history.length - 1; i >= 0; i--) {
      const reading = history[i]!;
      if (reading.deltaTC === null || reading.deltaTC <= attentionThresholdC) break;
      consecutiveAnomalousCount++;
    }
  }

  const lastPrior = priorSorted[priorSorted.length - 1];
  const minutesSinceLastValidReading = lastPrior ? Math.round(minutesBetween(current.measuredAt, lastPrior.measuredAt) * 10) / 10 : null;

  // Baseline: histórico anterior completo (o que o chamador tiver fornecido), nunca inclui `current` nem usa initiallyAnomalous.
  const baselineTemps = priorSorted.map((r) => r.temperatureMaxC);
  const baselineMean = mean(baselineTemps);
  const baseline: BaselineStat = {
    meanC: baselineMean,
    stdDevC: baselineMean === null ? null : stdDev(baselineTemps, baselineMean),
    sampleCount: baselineTemps.length,
    sufficient: baselineTemps.length >= MIN_BASELINE_SAMPLES,
  };

  const loadValues = priorSorted.map((r) => r.loadPercent).filter((v): v is number => v !== null);
  const currentValues = priorSorted.map((r) => r.currentA).filter((v): v is number => v !== null);
  const qualityValues = trendReadings.map((r) => r.signalQuality).filter((v): v is number => v !== null);

  return {
    featureVersion: THERMAL_FEATURE_VERSION,
    cutoffAt,
    mean5mC,
    mean15mC,
    mean60mC,
    max1hC,
    max6hC,
    max24hC,
    trendCPerHour,
    trendSampleCount: trendPoints.length,
    timeAboveLimitMin,
    consecutiveAnomalousCount,
    minutesSinceLastValidReading,
    baseline,
    currentLoadPercent: current.loadPercent,
    avgLoadPercent: mean(loadValues),
    loadSampleCount: loadValues.length,
    currentCurrentA: current.currentA,
    avgCurrentA: mean(currentValues),
    currentSampleCount: currentValues.length,
    aggregatedSignalQuality: mean(qualityValues),
    totalHistorySampleCount: priorSorted.length,
    sufficientForInference: trendCPerHour !== null && baseline.sufficient,
  };
}
