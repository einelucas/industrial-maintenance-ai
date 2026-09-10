import {
  TELEMETRY_MAX_BATCH_SIZE,
  TELEMETRY_SCHEMA_VERSION,
  thermalTelemetryEnvelopeSchema,
  thermalTelemetryReadingSchema,
} from "../src/features/telemetry/schemas/thermal-telemetry.schema";

const POINT_COUNT = 55;
const MINUTES_PER_DAY = 24 * 60;
const EXPECTED_READING_COUNT = POINT_COUNT * MINUTES_PER_DAY;

const latenciesMs: number[] = [];
let readingCount = 0;
let envelopeCount = 0;
let largestPayloadBytes = 0;
const startedAt = performance.now();

for (let pointNumber = 1; pointNumber <= POINT_COUNT; pointNumber++) {
  const pointCode = `TP-${String(pointNumber).padStart(3, "0")}`;
  let readings: unknown[] = [];

  for (let minute = 0; minute < MINUTES_PER_DAY; minute++) {
    const reading = {
      sequence: minute + 1,
      thermalPointCode: pointCode,
      measuredAt: new Date(Date.UTC(2026, 8, 9) - (MINUTES_PER_DAY - minute) * 60_000).toISOString(),
      temperatureMaxC: minute % 360 === 0 ? 75.6 : 42 + Math.sin(minute / 20) * 4,
      referenceTemperatureC: 40,
      currentA: 18 + Math.sin(minute / 15) * 5,
      loadPercent: 70 + Math.sin(minute / 15) * 15,
      emissivity: 0.95,
      signalQuality: 0.98,
    };
    thermalTelemetryReadingSchema.parse(reading);
    readings.push(reading);
    readingCount++;

    if (readings.length === TELEMETRY_MAX_BATCH_SIZE || minute === MINUTES_PER_DAY - 1) {
      const envelope = { schemaVersion: TELEMETRY_SCHEMA_VERSION, readings };
      const before = performance.now();
      thermalTelemetryEnvelopeSchema.parse(envelope);
      const serialized = JSON.stringify(envelope);
      latenciesMs.push(performance.now() - before);
      largestPayloadBytes = Math.max(largestPayloadBytes, Buffer.byteLength(serialized, "utf8"));
      envelopeCount++;
      readings = [];
    }
  }
}

if (readingCount !== EXPECTED_READING_COUNT) {
  throw new Error(`Carga incompleta: esperado ${EXPECTED_READING_COUNT}, obtido ${readingCount}.`);
}

latenciesMs.sort((a, b) => a - b);
const percentile = (fraction: number) => latenciesMs[Math.min(latenciesMs.length - 1, Math.floor(latenciesMs.length * fraction))] ?? 0;
const durationMs = performance.now() - startedAt;

process.stdout.write(`${JSON.stringify({
  status: "ok",
  points: POINT_COUNT,
  readingsPerMinute: POINT_COUNT,
  readingsPerDay: readingCount,
  envelopes: envelopeCount,
  maxBatchSize: TELEMETRY_MAX_BATCH_SIZE,
  largestPayloadBytes,
  validationLatencyMs: {
    p50: Number(percentile(0.5).toFixed(3)),
    p95: Number(percentile(0.95).toFixed(3)),
    maximum: Number(percentile(1).toFixed(3)),
  },
  totalDurationMs: Number(durationMs.toFixed(1)),
})}\n`);
