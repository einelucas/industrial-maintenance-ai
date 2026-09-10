import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import {
  authenticateTelemetryDevice,
  recordTelemetryRequest,
  TelemetryAuthError,
  telemetryIdentifierHash,
} from "@/features/telemetry/services/device-auth.service";
import { thermalTelemetryService } from "@/features/telemetry/services/thermal-telemetry.service";
import { TELEMETRY_MAX_PAYLOAD_BYTES } from "@/features/telemetry/schemas/thermal-telemetry.schema";
import { thermalAnalysisWorkerService } from "@/features/ai-core/services/thermal-analysis-worker.service";
import { thermalQueuePublisherService } from "@/features/telemetry/services/thermal-queue-publisher.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function errorResponse(message: string, code: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export async function POST(request: Request) {
  const identifierHash = telemetryIdentifierHash(request);
  let device: Awaited<ReturnType<typeof authenticateTelemetryDevice>>;
  try {
    device = await authenticateTelemetryDevice(request);
  } catch (error) {
    if (error instanceof TelemetryAuthError) return errorResponse(error.message, error.code, error.status);
    return errorResponse("Falha ao autenticar o dispositivo.", "AUTH_ERROR", 500);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > TELEMETRY_MAX_PAYLOAD_BYTES) {
    await recordTelemetryRequest({ sensorDeviceId: device.id, identifierHash, outcome: "REJECTED", reasonCode: "PAYLOAD_TOO_LARGE" });
    return errorResponse("Payload excede o limite permitido.", "PAYLOAD_TOO_LARGE", 413);
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > TELEMETRY_MAX_PAYLOAD_BYTES) {
    await recordTelemetryRequest({ sensorDeviceId: device.id, identifierHash, outcome: "REJECTED", reasonCode: "PAYLOAD_TOO_LARGE" });
    return errorResponse("Payload excede o limite permitido.", "PAYLOAD_TOO_LARGE", 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    await recordTelemetryRequest({ sensorDeviceId: device.id, identifierHash, outcome: "REJECTED", reasonCode: "INVALID_JSON" });
    return errorResponse("JSON inválido.", "INVALID_JSON", 400);
  }

  try {
    // A persistência de ThermalReading + InferenceRequest é atômica e ocorre
    // antes de qualquer inferência. O worker abaixo consome exclusivamente a
    // fila durável e nunca os dados ainda presentes no corpo da requisição.
    const ingestion = await thermalTelemetryService.ingest(payload, device);
    const queueTrigger = await thermalQueuePublisherService.publish(device.id, ingestion);
    const worker = ["LOCAL_FALLBACK", "PUBLISH_FAILED"].includes(queueTrigger.state)
      ? await thermalAnalysisWorkerService.run({ maxJobs: 55, concurrency: 8, timeBudgetMs: 10_000 })
      : null;

    // Não retorna risco, severidade, causa ou Prediction. O dispositivo só
    // recebe o resultado de recebimento/idempotência e o estado agregado da fila.
    return NextResponse.json({ ...ingestion, processing: {
      state: queueTrigger.state,
      processedCount: worker?.processedCount ?? 0,
      retryScheduledCount: worker?.retryScheduledCount ?? 0,
    } }, { status: 202 });
  } catch (error) {
    if (error instanceof AppError) {
      await recordTelemetryRequest({ sensorDeviceId: device.id, identifierHash, outcome: "REJECTED", reasonCode: error.code });
      return errorResponse(error.message, error.code, error.statusCode, error instanceof AppError && "issues" in error ? error.issues : undefined);
    }
    return errorResponse("Falha interna ao receber telemetria.", "INTERNAL_ERROR", 500);
  }
}
