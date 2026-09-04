import { z } from "zod";

// Núcleo de validação compartilhado por TODOS os canais de entrada (manual,
// CSV e simulador — GPMS 2026 / Etapa 4). Nenhum canal deve reimplementar
// estas faixas: cada schema de canal (ver `manual-thermal-reading.schema.ts`,
// `csv-thermal-reading-row.schema.ts`) estende este objeto apenas com o campo
// de identificação do ponto, que varia por canal (id vs. código).
//
// Deliberadamente ausentes deste schema — e portanto descartados por Zod se
// alguém tentar enviá-los: `source`, `analysisStatus`, `sequence`,
// `sensorDeviceId`, `deltaTC`, `rawPayload`, e qualquer campo de risco,
// severidade, causa ou diagnóstico. `source` é atribuído pelo service a
// partir do canal chamador, nunca pelo payload do cliente; `analysisStatus`
// nasce sempre `PENDING_AI`; `deltaTC` é sempre calculado no servidor
// (`thermal-reading-calculations.ts`), nunca aceito do cliente.

// Faixas de plausibilidade física — servem só para barrar erro grosseiro de
// digitação/sensor (ex.: "750" digitado por engano no lugar de "75.0").
// Nunca são usadas para classificar risco/severidade — isso é decisão da IA
// (Etapa 5+), não deste schema. Valores negativos de temperatura são
// aceitos deliberadamente: câmaras frias operam abaixo de 0 °C.
export const THERMAL_READING_PLAUSIBLE_RANGES = {
  temperatureC: { min: -50, max: 500 },
  ambientTemperatureC: { min: -40, max: 60 },
  currentA: { min: 0, max: 10000 },
  loadPercent: { min: 0, max: 300 },
} as const;

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MIN_PLAUSIBLE_DATE = new Date("2000-01-01T00:00:00.000Z");

function requiredRangedNumber(range: { min: number; max: number }, label: string) {
  return z.coerce
    .number()
    .finite(`${label} deve ser um número válido.`)
    .gte(range.min, `${label} implausível (abaixo de ${range.min}).`)
    .lte(range.max, `${label} implausível (acima de ${range.max}).`);
}

// IMPORTANTE: `z.coerce.number()` converte `""` em `0` (via `Number("")`)
// ANTES de qualquer `.optional()`/`.or(literal(""))` ter chance de agir —
// nessa ordem, campo vazio silenciosamente vira zero, exatamente o que a
// Etapa 4 proíbe ("vazio ≠ ausência ≠ zero"). Por isso o vazio é convertido
// para `undefined` em um `preprocess` que roda ANTES da coerção numérica,
// nunca depois.
function optionalRangedNumber(range: { min: number; max: number }, label: string) {
  return z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    requiredRangedNumber(range, label).optional()
  );
}

export const thermalReadingMeasurementSchema = z
  .object({
    measuredAt: z.coerce
      .date({ errorMap: () => ({ message: "Data/hora da medição inválida." }) })
      .refine((d) => d.getTime() >= MIN_PLAUSIBLE_DATE.getTime(), "Data/hora da medição implausível (anterior a 2000).")
      .refine((d) => d.getTime() <= Date.now() + FUTURE_TOLERANCE_MS, "Data/hora da medição não pode estar no futuro."),
    temperatureMaxC: requiredRangedNumber(THERMAL_READING_PLAUSIBLE_RANGES.temperatureC, "Temperatura máxima"),
    temperatureAverageC: optionalRangedNumber(THERMAL_READING_PLAUSIBLE_RANGES.temperatureC, "Temperatura média"),
    ambientTemperatureC: optionalRangedNumber(THERMAL_READING_PLAUSIBLE_RANGES.ambientTemperatureC, "Temperatura ambiente"),
    referenceTemperatureC: optionalRangedNumber(THERMAL_READING_PLAUSIBLE_RANGES.temperatureC, "Temperatura de referência"),
    currentA: optionalRangedNumber(THERMAL_READING_PLAUSIBLE_RANGES.currentA, "Corrente"),
    loadPercent: optionalRangedNumber(THERMAL_READING_PLAUSIBLE_RANGES.loadPercent, "Carga"),
    emissivity: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce
        .number()
        .finite("Emissividade deve ser um número válido.")
        .gt(0, "Emissividade deve ser maior que zero.")
        .lte(1, "Emissividade deve ser no máximo 1.")
        .optional()
    ),
    signalQuality: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? undefined : value),
      z.coerce
        .number()
        .finite("Qualidade de sinal deve ser um número válido.")
        .gte(0, "Qualidade de sinal deve ser no mínimo 0.")
        .lte(1, "Qualidade de sinal deve ser no máximo 1.")
        .optional()
    ),
  })
  .superRefine((data, ctx) => {
    // Tolerância de 0.05 °C só absorve arredondamento de ponto flutuante —
    // não é uma folga analítica.
    if (data.temperatureAverageC !== undefined && data.temperatureAverageC > data.temperatureMaxC + 0.05) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["temperatureAverageC"],
        message: "A temperatura média não pode ser maior que a temperatura máxima.",
      });
    }
  });

export type ThermalReadingMeasurementInput = z.infer<typeof thermalReadingMeasurementSchema>;
