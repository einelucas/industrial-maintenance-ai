import { z } from "zod";

function boundedEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export const TELEMETRY_SCHEMA_VERSION = "thermal-telemetry-v1" as const;
export const TELEMETRY_MAX_BATCH_SIZE = boundedEnv("TELEMETRY_MAX_BATCH_SIZE", 100, 1, 500);
export const TELEMETRY_MAX_PAYLOAD_BYTES = boundedEnv("TELEMETRY_MAX_PAYLOAD_BYTES", 262_144, 16_384, 2_097_152);
export const TELEMETRY_MAX_CLOCK_SKEW_SECONDS = boundedEnv("TELEMETRY_MAX_CLOCK_SKEW_SECONDS", 300, 0, 3600);
export const TELEMETRY_MAX_DELAY_DAYS = boundedEnv("TELEMETRY_MAX_DELAY_DAYS", 30, 1, 365);
export const TELEMETRY_RATE_LIMIT_PER_MINUTE = boundedEnv("TELEMETRY_RATE_LIMIT_PER_MINUTE", 60, 1, 600);

const optionalNumber = (min: number, max: number) => z.number().finite().min(min).max(max).optional();

export const thermalTelemetryReadingSchema = z.object({
  sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  thermalPointCode: z.string().trim().toUpperCase().regex(/^TP-[A-Z0-9-]{1,40}$/, "Código do ponto inválido."),
  measuredAt: z.string().datetime({ offset: true }),
  temperatureMaxC: z.number().finite().min(-50).max(300),
  temperatureAverageC: optionalNumber(-50, 300),
  ambientTemperatureC: optionalNumber(-50, 100),
  referenceTemperatureC: optionalNumber(-50, 300),
  currentA: optionalNumber(0, 100_000),
  loadPercent: optionalNumber(0, 200),
  emissivity: optionalNumber(0.01, 1),
  signalQuality: optionalNumber(0, 1),
}).strict();

export const thermalTelemetryEnvelopeSchema = z.object({
  schemaVersion: z.literal(TELEMETRY_SCHEMA_VERSION),
  readings: z.array(z.unknown()).min(1).max(TELEMETRY_MAX_BATCH_SIZE),
}).strict();

export type ThermalTelemetryReadingInput = z.infer<typeof thermalTelemetryReadingSchema>;
