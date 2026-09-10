import { createHash } from "node:crypto";
import { send } from "@vercel/queue";
import type { ThermalTelemetryResult } from "@/features/telemetry/services/thermal-telemetry.service";

export const THERMAL_ANALYSIS_QUEUE_TOPIC = "thermal-analysis";

export interface ThermalQueuePublishResult {
  state: "QUEUE_PUBLISHED" | "LOCAL_FALLBACK" | "PUBLISH_FAILED" | "NOT_REQUIRED";
  messageId?: string;
}

function idempotencyKey(deviceId: string, ingestion: ThermalTelemetryResult): string {
  const readingIds = ingestion.results
    .filter((result) => result.status === "ACCEPTED" && result.thermalReadingId)
    .map((result) => result.thermalReadingId)
    .sort()
    .join("|");
  return `thermal-${createHash("sha256").update(`${deviceId}|${readingIds}`).digest("hex")}`;
}

export const thermalQueuePublisherService = {
  async publish(deviceId: string, ingestion: ThermalTelemetryResult): Promise<ThermalQueuePublishResult> {
    if (!ingestion.queuedCount) return { state: "NOT_REQUIRED" };

    // `vercel dev`/Next local não possui credenciais OIDC da fila. Nesse
    // ambiente a rota usa o worker PostgreSQL inline; no deploy, a fila
    // oficial desacopla o ACK do dispositivo da inferência.
    if (!process.env.VERCEL_ENV) return { state: "LOCAL_FALLBACK" };

    try {
      const published = await send(
        THERMAL_ANALYSIS_QUEUE_TOPIC,
        { schemaVersion: 1, requestedJobs: ingestion.queuedCount },
        { idempotencyKey: idempotencyKey(deviceId, ingestion), retentionSeconds: 86_400 },
      );
      return { state: "QUEUE_PUBLISHED", ...(published.messageId ? { messageId: published.messageId } : {}) };
    } catch {
      return { state: "PUBLISH_FAILED" };
    }
  },
};
