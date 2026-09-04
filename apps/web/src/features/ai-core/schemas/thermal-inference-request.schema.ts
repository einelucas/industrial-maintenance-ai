import { z } from "zod";
import { ElectricalComponentType } from "@prisma/client";

// Contrato de REQUISIÇÃO ao gateway de IA térmica (GPMS 2026 / Etapa 5).
// `.strict()` em todos os objetos — não é só documentação, é defesa em
// profundidade: mesmo que o orquestrador tentasse incluir por engano
// `initiallyAnomalous`, causa verdadeira do simulador, decisão humana futura
// ou qualquer campo de "resposta esperada", a validação da REQUISIÇÃO (antes
// de sair pela rede) rejeitaria o payload inteiro por causa da chave extra.

const currentReadingSchema = z
  .object({
    temperatureMaxC: z.number().finite(),
    temperatureAverageC: z.number().finite().nullable(),
    ambientTemperatureC: z.number().finite().nullable(),
    referenceTemperatureC: z.number().finite().nullable(),
    deltaTC: z.number().finite().nullable(),
    currentA: z.number().finite().nullable(),
    loadPercent: z.number().finite().nullable(),
    signalQuality: z.number().finite().nullable(),
    measuredAt: z.string().datetime(),
  })
  .strict();

const windowFeaturesSchema = z
  .object({
    mean5mC: z.number().finite().nullable(),
    mean5mSampleCount: z.number().int().nonnegative(),
    mean15mC: z.number().finite().nullable(),
    mean15mSampleCount: z.number().int().nonnegative(),
    mean60mC: z.number().finite().nullable(),
    mean60mSampleCount: z.number().int().nonnegative(),
    max1hC: z.number().finite().nullable(),
    max6hC: z.number().finite().nullable(),
    max24hC: z.number().finite().nullable(),
    trendCPerHour: z.number().finite().nullable(),
    trendSampleCount: z.number().int().nonnegative(),
    timeAboveLimitMin: z.number().finite().nullable(),
    consecutiveAnomalousCount: z.number().int().nonnegative(),
    minutesSinceLastValidReading: z.number().finite().nullable(),
  })
  .strict();

const baselineSchema = z
  .object({
    meanC: z.number().finite().nullable(),
    stdDevC: z.number().finite().nullable(),
    sampleCount: z.number().int().nonnegative(),
    sufficient: z.boolean(),
    avgLoadPercent: z.number().finite().nullable(),
    avgCurrentA: z.number().finite().nullable(),
  })
  .strict();

const thresholdsSchema = z
  .object({
    absoluteLimitC: z.number().finite().nullable(),
    attentionDeltaTC: z.number().finite().nullable(),
    highDeltaTC: z.number().finite().nullable(),
    criticalDeltaTC: z.number().finite().nullable(),
  })
  .strict();

const qualitySchema = z
  .object({
    sufficientForInference: z.boolean(),
    totalHistorySampleCount: z.number().int().nonnegative(),
    aggregatedSignalQuality: z.number().finite().nullable(),
  })
  .strict();

export const thermalInferenceRequestSchema = z
  .object({
    inferenceRequestId: z.string().min(1),
    thermalReadingId: z.string().uuid(),
    thermalPointId: z.string().uuid(),
    componentType: z.nativeEnum(ElectricalComponentType),
    featureVersion: z.string().min(1),
    current: currentReadingSchema,
    window: windowFeaturesSchema,
    baseline: baselineSchema,
    thresholds: thresholdsSchema,
    quality: qualitySchema,
  })
  .strict();

export type ThermalInferenceRequest = z.infer<typeof thermalInferenceRequestSchema>;
