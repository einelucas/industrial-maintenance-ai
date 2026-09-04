import { createRng, hashSeed, rngNoise, type Rng } from "./rng";

// Cenários do simulador de leituras avulsas (GPMS 2026 / Etapa 4) — geram a
// telemetria de UM ponto termográfico sob demanda, ao contrário do cenário
// da Etapa 2 (que semeia a planta inteira uma única vez). Reutiliza o mesmo
// PRNG determinístico (mulberry32) e nunca usa `Math.random()`/`Date.now()`
// diretamente: o instante final da série (`endAt`) é sempre um parâmetro
// injetado pelo chamador, nunca lido daqui de dentro.
//
// Cada função devolve só números/datas brutos — nenhuma delas decide risco,
// severidade ou causa. O NOME do cenário (ex.: "OVERLOAD") é apenas um rótulo
// de operação para quem está gerando o teste; ele nunca é persistido na
// leitura (não existe coluna para isso) e nunca deve ser tratado como
// "ground truth" pela aplicação — só o manifesto de avaliação, fora do
// caminho de decisão, pode carregar esse significado (mesma regra da Etapa 2).

export const SIMULATOR_SCENARIOS = [
  "NORMAL_LOW_LOAD",
  "NORMAL_HIGH_LOAD",
  "PROGRESSIVE_HEATING",
  "OVERLOAD",
  "DEGRADED_CONNECTION",
  "CRITICAL_75_6",
  "POST_MAINTENANCE_RECOVERY",
  "SENSOR_OFFLINE",
  "INVALID_SENSOR",
] as const;

export type SimulatorScenario = (typeof SIMULATOR_SCENARIOS)[number];

export interface GenerateScenarioParams {
  thermalPointCode: string;
  scenario: SimulatorScenario;
  seed: number;
  /** Quantidade de amostras solicitada. Alguns cenários (ex.: SENSOR_OFFLINE) devolvem menos do que isso, de propósito. */
  sampleCount: number;
  intervalMinutes: number;
  /** Instante da amostra mais recente — parâmetro injetado, nunca `new Date()` calculado aqui dentro. */
  endAt: Date;
  /** Temperatura de referência usada para ΔT (ex.: componente saudável equivalente). Se omitida, aproxima-se do ambiente. */
  referenceTemperatureC?: number;
  /** Corrente nominal do componente simulado, para derivar `currentA` a partir da carga. */
  ratedCurrent?: number;
  ambientBaselineC?: number;
}

export interface RawSimulatedRow {
  thermalPointCode: string;
  measuredAt: Date;
  temperatureMaxC: number;
  temperatureAverageC?: number;
  ambientTemperatureC?: number;
  referenceTemperatureC?: number;
  currentA?: number;
  loadPercent?: number;
  emissivity?: number;
  signalQuality?: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function shapeProgress(shape: "linear" | "accelerating" | "plateau" | "oscillating", progress: number): number {
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

function ambientC(rng: Rng, baseline: number): number {
  return round1(baseline + rngNoise(rng) * 1.5);
}

function loadInRange(rng: Rng, min: number, max: number): number {
  const mid = (min + max) / 2;
  const spread = (max - min) * 0.2;
  return round1(Math.min(max, Math.max(min, mid + rngNoise(rng) * spread)));
}

function timestampFor(endAt: Date, index: number, count: number, intervalMinutes: number): Date {
  return new Date(endAt.getTime() - (count - 1 - index) * intervalMinutes * 60_000);
}

interface SteadyStateConfig {
  loadRange: [number, number];
  baselineRiseC: number;
  extraRise?: { targetC: number; shape: "linear" | "accelerating" | "plateau" | "oscillating" };
}

function generateSteadyState(params: GenerateScenarioParams, config: SteadyStateConfig): RawSimulatedRow[] {
  const { thermalPointCode, seed, scenario, sampleCount, intervalMinutes, endAt } = params;
  const ambientBaseline = params.ambientBaselineC ?? 25;
  const ratedCurrent = params.ratedCurrent ?? 32;
  const rng = createRng(hashSeed(seed, `${scenario}-${thermalPointCode}`));
  const count = Math.max(1, sampleCount);

  const rows: RawSimulatedRow[] = [];
  for (let i = 0; i < count; i++) {
    const measuredAt = timestampFor(endAt, i, count, intervalMinutes);
    const load = loadInRange(rng, config.loadRange[0], config.loadRange[1]);
    const ambient = ambientC(rng, ambientBaseline);
    const referenceTemperatureC = round1(params.referenceTemperatureC ?? ambientBaseline);

    const progress = count > 1 ? i / (count - 1) : 1;
    const extraRiseC = config.extraRise ? config.extraRise.targetC * shapeProgress(config.extraRise.shape, progress) : 0;

    const temperatureMaxC = round1(ambient + config.baselineRiseC * (load / 100) + extraRiseC + rngNoise(rng) * 0.5);
    const currentA = round1(ratedCurrent * (load / 100) * (1 + rngNoise(rng) * 0.04));

    rows.push({
      thermalPointCode,
      measuredAt,
      temperatureMaxC,
      temperatureAverageC: round1(temperatureMaxC - (0.6 + rng() * 0.8)),
      ambientTemperatureC: ambient,
      referenceTemperatureC,
      currentA,
      loadPercent: load,
      emissivity: round1(0.92 + rngNoise(rng) * 0.01),
      signalQuality: Math.min(0.99, Math.max(0.9, round1(0.97 + rngNoise(rng) * 0.02))),
    });
  }
  return rows;
}

function generateCritical756(params: GenerateScenarioParams): RawSimulatedRow[] {
  const rows = generateSteadyState(params, {
    loadRange: [70, 90],
    baselineRiseC: 12,
    extraRise: { targetC: 30, shape: "accelerating" },
  });
  const last = rows[rows.length - 1];
  if (last) {
    // Pico oficial do desafio GPMS 2026, fixado ao valor exato — mesma
    // convenção da Etapa 2: chega até aqui por uma evolução plausível, nunca
    // como um ponto isolado sem contexto.
    last.temperatureMaxC = 75.6;
    last.referenceTemperatureC = 40.0;
    last.temperatureAverageC = 74.8;
  }
  return rows;
}

function generateDegradedConnection(params: GenerateScenarioParams): RawSimulatedRow[] {
  const rows = generateSteadyState(params, { loadRange: [40, 60], baselineRiseC: 8 });
  const rng = createRng(hashSeed(params.seed, `degraded-mask-${params.thermalPointCode}`));
  // Telemetria parcial: sinal ruim faz a origem perder alguns campos
  // secundários (nunca a temperatura, que é obrigatória) e reportar
  // qualidade de sinal baixa — nunca zero-fabricado no lugar de um campo
  // ausente.
  return rows.map((row) => {
    const degraded = rng() < 0.4;
    return {
      ...row,
      signalQuality: round1(0.3 + rng() * 0.3),
      ambientTemperatureC: degraded ? undefined : row.ambientTemperatureC,
      currentA: degraded ? undefined : row.currentA,
    };
  });
}

function generatePostMaintenanceRecovery(params: GenerateScenarioParams): RawSimulatedRow[] {
  const { thermalPointCode, seed, scenario, sampleCount, intervalMinutes, endAt } = params;
  const ambientBaseline = params.ambientBaselineC ?? 25;
  const rng = createRng(hashSeed(seed, `${scenario}-${thermalPointCode}`));
  const count = Math.max(1, sampleCount);
  const startDeltaC = 24; // elevação residual logo após a intervenção

  const rows: RawSimulatedRow[] = [];
  for (let i = 0; i < count; i++) {
    const measuredAt = timestampFor(endAt, i, count, intervalMinutes);
    const progress = count > 1 ? i / (count - 1) : 1;
    const ambient = ambientC(rng, ambientBaseline);
    const referenceTemperatureC = round1(params.referenceTemperatureC ?? ambientBaseline);
    const residualC = startDeltaC * Math.exp(-3.5 * progress);
    const temperatureMaxC = round1(ambient + 4 + residualC + rngNoise(rng) * 0.4);

    rows.push({
      thermalPointCode,
      measuredAt,
      temperatureMaxC,
      temperatureAverageC: round1(temperatureMaxC - (0.6 + rng() * 0.8)),
      ambientTemperatureC: ambient,
      referenceTemperatureC,
      currentA: params.ratedCurrent ? round1(params.ratedCurrent * 0.5) : undefined,
      loadPercent: 50,
      emissivity: round1(0.92 + rngNoise(rng) * 0.01),
      signalQuality: 0.98,
    });
  }
  return rows;
}

function generateSensorOffline(params: GenerateScenarioParams): RawSimulatedRow[] {
  // O sensor fica fora do ar na janela mais recente da série solicitada —
  // representamos isso pela AUSÊNCIA de linhas, nunca por uma leitura
  // fabricada com temperatura zero (ou qualquer outro valor inventado) no
  // lugar da telemetria que nunca chegou.
  const count = Math.max(1, params.sampleCount);
  const onlineCount = Math.max(1, Math.floor(count / 3));
  return generateSteadyState(
    { ...params, sampleCount: onlineCount },
    { loadRange: [30, 50], baselineRiseC: 7 }
  ).map((row, i) => ({
    ...row,
    // Recoloca os timestamps das amostras "ainda online" no início real da
    // janela solicitada (não nos últimos `onlineCount` slots) — o sensor
    // para de reportar e nunca mais volta dentro da janela.
    measuredAt: timestampFor(params.endAt, i, count, params.intervalMinutes),
  }));
}

function generateInvalidSensor(params: GenerateScenarioParams): RawSimulatedRow[] {
  // Gera deliberadamente telemetria fora de qualquer faixa plausível — este
  // cenário existe para provar que o mesmo schema de validação usado por
  // manual/CSV também barra um "sensor" simulado malcomportado antes de
  // qualquer persistência. Nenhuma linha aqui deve sobreviver à validação.
  const rng = createRng(hashSeed(params.seed, `invalid-${params.thermalPointCode}`));
  const count = Math.max(1, params.sampleCount);
  const rows: RawSimulatedRow[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      thermalPointCode: params.thermalPointCode,
      measuredAt: timestampFor(params.endAt, i, count, params.intervalMinutes),
      temperatureMaxC: rng() < 0.5 ? 9999 : -9999,
      emissivity: 5,
      signalQuality: 12,
    });
  }
  return rows;
}

/** Ponto único de entrada — despacha para o gerador do cenário selecionado. */
export function generateScenarioReadings(params: GenerateScenarioParams): RawSimulatedRow[] {
  switch (params.scenario) {
    case "NORMAL_LOW_LOAD":
      return generateSteadyState(params, { loadRange: [15, 35], baselineRiseC: 6 });
    case "NORMAL_HIGH_LOAD":
      return generateSteadyState(params, { loadRange: [75, 95], baselineRiseC: 10 });
    case "PROGRESSIVE_HEATING":
      return generateSteadyState(params, {
        loadRange: [55, 75],
        baselineRiseC: 9,
        extraRise: { targetC: 12, shape: "accelerating" },
      });
    case "OVERLOAD":
      return generateSteadyState(params, {
        loadRange: [105, 135],
        baselineRiseC: 9,
        extraRise: { targetC: 18, shape: "oscillating" },
      });
    case "DEGRADED_CONNECTION":
      return generateDegradedConnection(params);
    case "CRITICAL_75_6":
      return generateCritical756(params);
    case "POST_MAINTENANCE_RECOVERY":
      return generatePostMaintenanceRecovery(params);
    case "SENSOR_OFFLINE":
      return generateSensorOffline(params);
    case "INVALID_SENSOR":
      return generateInvalidSensor(params);
    default: {
      const exhaustive: never = params.scenario;
      throw new Error(`Cenário de simulação desconhecido: ${exhaustive}`);
    }
  }
}
