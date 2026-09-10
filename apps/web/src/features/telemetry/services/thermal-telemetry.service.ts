import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ValidationError } from "@/lib/errors";
import { calculateDeltaT } from "@/features/thermal-readings/services/thermal-reading-calculations";
import { buildInferenceRequestId } from "@/features/ai-core/services/inference-request-id";
import { THERMAL_FEATURE_VERSION } from "@/features/ai-core/temporal-features/calculate-temporal-features";
import {
  TELEMETRY_MAX_CLOCK_SKEW_SECONDS,
  TELEMETRY_MAX_DELAY_DAYS,
  thermalTelemetryEnvelopeSchema,
  thermalTelemetryReadingSchema,
  type ThermalTelemetryReadingInput,
} from "@/features/telemetry/schemas/thermal-telemetry.schema";
import type { AuthenticatedTelemetryDevice } from "@/features/telemetry/services/device-auth.service";

export type TelemetryItemStatus = "ACCEPTED" | "DUPLICATE" | "REJECTED";

export interface TelemetryItemResult {
  index: number;
  sequence: number | null;
  status: TelemetryItemStatus;
  code?: string;
  message?: string;
  thermalReadingId?: string;
}

export interface ThermalTelemetryResult {
  schemaVersion: "thermal-telemetry-v1";
  receivedCount: number;
  acceptedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  queuedCount: number;
  results: TelemetryItemResult[];
}

interface Candidate {
  index: number;
  input: ThermalTelemetryReadingInput;
  sequence: bigint;
  id: string;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

function itemError(index: number, raw: unknown, code: string, message: string): TelemetryItemResult {
  const sequence = raw && typeof raw === "object" && "sequence" in raw && typeof raw.sequence === "number" ? raw.sequence : null;
  return { index, sequence, status: "REJECTED", code, message };
}

export const thermalTelemetryService = {
  async ingest(rawEnvelope: unknown, device: AuthenticatedTelemetryDevice, now = new Date()): Promise<ThermalTelemetryResult> {
    const envelope = thermalTelemetryEnvelopeSchema.safeParse(rawEnvelope);
    if (!envelope.success) {
      throw new ValidationError("Envelope de telemetria inválido.", envelope.error.flatten().fieldErrors);
    }

    const results: TelemetryItemResult[] = [];
    const candidates: Candidate[] = [];
    const sequencesInBatch = new Set<string>();
    const minMeasuredAt = now.getTime() - TELEMETRY_MAX_DELAY_DAYS * 86_400_000;
    const maxMeasuredAt = now.getTime() + TELEMETRY_MAX_CLOCK_SKEW_SECONDS * 1000;

    envelope.data.readings.forEach((raw, index) => {
      const parsed = thermalTelemetryReadingSchema.safeParse(raw);
      if (!parsed.success) {
        results.push(itemError(index, raw, "INVALID_ITEM", parsed.error.issues.map((issue) => issue.message).join(" ")));
        return;
      }

      if (parsed.data.thermalPointCode !== device.thermalPoint.code) {
        results.push(itemError(index, raw, "POINT_NOT_AUTHORIZED", "A credencial não está autorizada para este ponto termográfico."));
        return;
      }

      const measuredAt = new Date(parsed.data.measuredAt).getTime();
      if (measuredAt > maxMeasuredAt) {
        results.push(itemError(index, raw, "TIMESTAMP_IN_FUTURE", "Horário da leitura excede a tolerância configurada."));
        return;
      }
      if (measuredAt < minMeasuredAt) {
        results.push(itemError(index, raw, "READING_TOO_OLD", "Leitura anterior à janela de reconexão configurada."));
        return;
      }

      const sequence = BigInt(parsed.data.sequence);
      const sequenceKey = sequence.toString();
      if (sequencesInBatch.has(sequenceKey)) {
        results.push({ index, sequence: parsed.data.sequence, status: "DUPLICATE", code: "DUPLICATE_IN_BATCH" });
        return;
      }
      sequencesInBatch.add(sequenceKey);
      candidates.push({ index, input: parsed.data, sequence, id: randomUUID() });
    });

    const existing = candidates.length
      ? await prisma.thermalReading.findMany({
          where: { sensorDeviceId: device.id, sequence: { in: candidates.map((candidate) => candidate.sequence) } },
          select: { id: true, sequence: true },
        })
      : [];
    const existingBySequence = new Map(existing.map((reading) => [reading.sequence!.toString(), reading.id]));
    const newCandidates: Candidate[] = [];

    for (const candidate of candidates) {
      const existingId = existingBySequence.get(candidate.sequence.toString());
      if (existingId) {
        results.push({ index: candidate.index, sequence: candidate.input.sequence, status: "DUPLICATE", code: "ALREADY_RECEIVED", thermalReadingId: existingId });
      } else {
        newCandidates.push(candidate);
        results.push({ index: candidate.index, sequence: candidate.input.sequence, status: "ACCEPTED", thermalReadingId: candidate.id });
      }
    }

    let insertedCount = 0;
    let queuedCount = 0;
    const persistedBySequence = new Map<string, string>();
    await prisma.$transaction(async (tx) => {
      if (newCandidates.length) {
        const inserted = await tx.thermalReading.createMany({
          data: newCandidates.map(({ id, input, sequence }) => ({
            id,
            thermalPointId: device.thermalPoint.id,
            sensorDeviceId: device.id,
            measuredAt: new Date(input.measuredAt),
            sequence,
            temperatureMaxC: input.temperatureMaxC,
            temperatureAverageC: input.temperatureAverageC,
            ambientTemperatureC: input.ambientTemperatureC,
            referenceTemperatureC: input.referenceTemperatureC,
            deltaTC: calculateDeltaT(input.temperatureMaxC, input.referenceTemperatureC),
            currentA: input.currentA,
            loadPercent: input.loadPercent,
            emissivity: input.emissivity,
            signalQuality: input.signalQuality,
            source: device.thermalPoint.monitoringMode,
            rawPayload: jsonValue(input),
          })),
          skipDuplicates: true,
        });
        insertedCount = inserted.count;

        const persisted = await tx.thermalReading.findMany({
          where: { sensorDeviceId: device.id, sequence: { in: newCandidates.map((candidate) => candidate.sequence) } },
          select: { id: true, sequence: true, thermalPointId: true },
        });
        persisted.forEach((reading) => persistedBySequence.set(reading.sequence!.toString(), reading.id));
        const queued = await tx.inferenceRequest.createMany({
          data: persisted.map((reading) => ({
            inferenceRequestId: buildInferenceRequestId(reading.id, THERMAL_FEATURE_VERSION),
            thermalReadingId: reading.id,
            thermalPointId: reading.thermalPointId,
            featureVersion: THERMAL_FEATURE_VERSION,
            status: "PENDING",
            availableAt: now,
          })),
          skipDuplicates: true,
        });
        queuedCount = queued.count;
      }

      const validSequences = candidates.map((candidate) => candidate.sequence);
      const highestReceived = validSequences.reduce<bigint | null>((highest, value) => highest === null || value > highest ? value : highest, device.lastSequence);
      if (candidates.length) {
        await tx.sensorDevice.update({
          where: { id: device.id },
          data: {
            lastSeenAt: now,
            lastSequence: highestReceived,
            status: "ONLINE",
            lastAuthFailureAt: null,
            consecutiveAuthFailures: 0,
          },
        });
      }

      const duplicateCount = results.filter((result) => result.status === "DUPLICATE").length + Math.max(0, newCandidates.length - insertedCount);
      const rejectedCount = results.filter((result) => result.status === "REJECTED").length;
      await tx.deviceTelemetryRequest.create({
        data: {
          sensorDeviceId: device.id,
          identifierHash: device.identifierHash,
          outcome: rejectedCount > 0 ? "PARTIAL" : "ACCEPTED",
          itemCount: envelope.data.readings.length,
          acceptedCount: insertedCount,
          duplicateCount,
          rejectedCount,
        },
      });
    });

    // `skipDuplicates` também protege contra duas requisições concorrentes.
    // Se outra transação venceu a corrida, o item precisa ser devolvido como
    // DUPLICATE (com o id realmente persistido), nunca como ACCEPTED.
    for (const result of results) {
      if (result.status !== "ACCEPTED" || result.sequence === null) continue;
      const persistedId = persistedBySequence.get(String(result.sequence));
      if (persistedId && persistedId !== result.thermalReadingId) {
        result.status = "DUPLICATE";
        result.code = "ALREADY_RECEIVED";
        result.thermalReadingId = persistedId;
      }
    }

    results.sort((a, b) => a.index - b.index);
    const rejectedCount = results.filter((result) => result.status === "REJECTED").length;
    const duplicateCount = envelope.data.readings.length - insertedCount - rejectedCount;
    return {
      schemaVersion: "thermal-telemetry-v1",
      receivedCount: envelope.data.readings.length,
      acceptedCount: insertedCount,
      duplicateCount,
      rejectedCount,
      queuedCount,
      results,
    };
  },
};
