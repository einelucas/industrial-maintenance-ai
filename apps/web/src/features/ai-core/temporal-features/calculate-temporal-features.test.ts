import { describe, expect, it } from "vitest";
import { calculateTemporalFeatures, THERMAL_FEATURE_VERSION, type TemporalFeatureReading } from "./calculate-temporal-features";

function reading(minutesAgoFromCutoff: number, temperatureMaxC: number, overrides: Partial<TemporalFeatureReading> = {}): TemporalFeatureReading {
  const cutoff = new Date("2026-09-04T12:00:00.000Z");
  return {
    measuredAt: new Date(cutoff.getTime() - minutesAgoFromCutoff * 60_000),
    temperatureMaxC,
    deltaTC: null,
    currentA: null,
    loadPercent: null,
    signalQuality: null,
    ...overrides,
  };
}

const CUTOFF = new Date("2026-09-04T12:00:00.000Z");

describe("calculateTemporalFeatures — versão e determinismo", () => {
  it("registra a versão das features e é determinística para a mesma entrada", () => {
    const current = reading(0, 50);
    const priorReadings = [reading(10, 48), reading(20, 46)];
    const a = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: 10 });
    const b = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: 10 });
    expect(a.featureVersion).toBe(THERMAL_FEATURE_VERSION);
    expect(a).toEqual(b);
  });
});

describe("calculateTemporalFeatures — janelas 5/15/60 min", () => {
  it("inclui só leituras dentro de cada janela e reporta sampleCount honesto", () => {
    const current = reading(0, 60);
    const priorReadings = [reading(3, 58), reading(10, 55), reading(40, 50), reading(120, 40)];
    const result = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: null });

    expect(result.mean5mC.sampleCount).toBe(2); // current (0min) + reading(3min)
    expect(result.mean15mC.sampleCount).toBe(3); // + reading(10min)
    expect(result.mean60mC.sampleCount).toBe(4); // + reading(40min), reading(120min) fica de fora
  });

  it("séries irregulares (amostragem horária): janelas curtas ficam com sampleCount 1, nunca inventam amostra", () => {
    // Cobertura de borda: séries com amostragem horária (mais grossa que a
    // janela de 5/15 min) nunca podem alimentar essas janelas curtas com
    // mais de 1 amostra — e, se toda a série fosse assim (ver
    // SAMPLE_INTERVAL_MINUTES em thermal-series.ts), a janela de 60 min/
    // tendência também travaria em 1 amostra por causa da borda exclusiva.
    const current = reading(0, 55.2);
    const priorReadings = [reading(60, 55.7), reading(120, 55.2), reading(180, 56.3)];
    const result = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: null });

    expect(result.mean5mC.sampleCount).toBe(1);
    expect(result.mean5mC.value).toBe(55.2);
    expect(result.mean15mC.sampleCount).toBe(1);
  });
});

describe("calculateTemporalFeatures — máximos", () => {
  it("calcula o máximo de 1h/6h/24h corretamente", () => {
    const current = reading(0, 50);
    const priorReadings = [reading(30, 75.6), reading(200, 90), reading(1000, 100)];
    const result = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: null });

    expect(result.max1hC.value).toBe(75.6);
    expect(result.max6hC.value).toBe(90);
    expect(result.max24hC.value).toBe(100);
  });
});

describe("calculateTemporalFeatures — tendência", () => {
  it("calcula tendência positiva por regressão linear (não apenas último - primeiro)", () => {
    // Série exatamente linear (40, 45, 50 a cada 20 min) para verificar a
    // inclinação esperada com precisão: +5°C/20min = +15°C/h.
    const current = reading(0, 50);
    const priorReadings = [reading(20, 45), reading(40, 40)];
    const result = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: null });

    expect(result.trendCPerHour).toBeCloseTo(15, 5);
    expect(result.trendSampleCount).toBe(3);
  });

  it("devolve null quando há menos de 2 amostras na janela de 60 min", () => {
    const current = reading(0, 50);
    const result = calculateTemporalFeatures({ current, priorReadings: [], attentionThresholdC: null });
    expect(result.trendCPerHour).toBeNull();
    expect(result.sufficientForInference).toBe(false);
  });
});

describe("calculateTemporalFeatures — tempo acima do limite e anomalias consecutivas", () => {
  it("soma o tempo com ΔT acima do limite nas últimas 24h", () => {
    const current = reading(0, 70, { deltaTC: 25 });
    const priorReadings = [reading(60, 68, { deltaTC: 22 }), reading(120, 50, { deltaTC: 5 })];
    const result = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: 10 });

    // reading(120min, deltaT=5) está abaixo do limite — não conta.
    // reading(60min, deltaT=22) acima do limite, intervalo até a próxima (current, 0min) = 60min.
    // current (deltaT=25) acima do limite, intervalo até o cutoff = 0min (é o próprio cutoff).
    expect(result.timeAboveLimitMin).toBe(60);
    expect(result.consecutiveAnomalousCount).toBe(2);
  });

  it("devolve null quando não há limite de atenção configurado", () => {
    const current = reading(0, 70, { deltaTC: 25 });
    const result = calculateTemporalFeatures({ current, priorReadings: [], attentionThresholdC: null });
    expect(result.timeAboveLimitMin).toBeNull();
    expect(result.consecutiveAnomalousCount).toBe(0);
  });

  it("nunca usa uma leitura sem deltaTC para decidir anomalia", () => {
    const current = reading(0, 70, { deltaTC: null });
    const priorReadings = [reading(30, 68, { deltaTC: 25 })];
    const result = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: 10 });
    // current não tem deltaTC -> a sequência de "consecutivas" para no topo.
    expect(result.consecutiveAnomalousCount).toBe(0);
  });
});

describe("calculateTemporalFeatures — ausência de leitura futura (anti-vazamento)", () => {
  it("ignora qualquer leitura com measuredAt posterior ao cutoff, mesmo se estiver em priorReadings por engano", () => {
    const current = reading(0, 50);
    const futureReading: TemporalFeatureReading = { ...reading(-30, 999), measuredAt: new Date(CUTOFF.getTime() + 30 * 60_000) };
    const result = calculateTemporalFeatures({ current, priorReadings: [futureReading], attentionThresholdC: null });

    expect(result.max24hC.value).toBe(50); // não 999
    expect(result.totalHistorySampleCount).toBe(0); // a leitura futura não conta como histórico anterior
  });
});

describe("calculateTemporalFeatures — baseline", () => {
  it("marca sufficient=false com poucas amostras e nunca usa a leitura atual no cálculo", () => {
    const current = reading(0, 200); // outlier proposital
    const priorReadings = [reading(60, 50), reading(120, 51)];
    const result = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: null });

    expect(result.baseline.sampleCount).toBe(2);
    expect(result.baseline.sufficient).toBe(false);
    expect(result.baseline.meanC).toBeCloseTo(50.5, 5); // não influenciado pelo outlier "current"
  });

  it("marca sufficient=true com amostras suficientes", () => {
    const current = reading(0, 55);
    const priorReadings = Array.from({ length: 12 }, (_, i) => reading((i + 1) * 60, 50 + i));
    const result = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: null });
    expect(result.baseline.sufficient).toBe(true);
  });
});

describe("calculateTemporalFeatures — carga, corrente e qualidade", () => {
  it("expõe carga/corrente atual e média histórica separadamente", () => {
    const current = reading(0, 60, { loadPercent: 90, currentA: 40 });
    const priorReadings = [reading(60, 55, { loadPercent: 50, currentA: 20 }), reading(120, 52, { loadPercent: 60, currentA: 24 })];
    const result = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: null });

    expect(result.currentLoadPercent).toBe(90);
    expect(result.avgLoadPercent).toBe(55);
    expect(result.currentCurrentA).toBe(40);
    expect(result.avgCurrentA).toBe(22);
  });

  it("agrega qualidade de sinal só das leituras que a informaram", () => {
    const current = reading(0, 60, { signalQuality: 0.9 });
    const priorReadings = [reading(30, 58, { signalQuality: null }), reading(50, 57, { signalQuality: 0.8 })];
    const result = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: null });
    expect(result.aggregatedSignalQuality).toBeCloseTo(0.85, 5);
  });
});

describe("calculateTemporalFeatures — minutos desde a última leitura válida", () => {
  it("calcula a partir da leitura anterior mais recente", () => {
    const current = reading(0, 50);
    const priorReadings = [reading(45, 48), reading(200, 40)];
    const result = calculateTemporalFeatures({ current, priorReadings, attentionThresholdC: null });
    expect(result.minutesSinceLastValidReading).toBe(45);
  });

  it("devolve null quando não há leitura anterior", () => {
    const current = reading(0, 50);
    const result = calculateTemporalFeatures({ current, priorReadings: [], attentionThresholdC: null });
    expect(result.minutesSinceLastValidReading).toBeNull();
  });
});
