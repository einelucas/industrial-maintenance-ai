import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { TELEMETRY_RATE_LIMIT_PER_MINUTE } from "@/features/telemetry/schemas/thermal-telemetry.schema";

export class TelemetryAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 429,
    readonly code: "AUTH_REQUIRED" | "INVALID_CREDENTIAL" | "DEVICE_BLOCKED" | "RATE_LIMITED",
  ) {
    super(message);
    this.name = "TelemetryAuthError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function equalHash(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

export function telemetryIdentifierHash(request: Request): string {
  const deviceId = request.headers.get("x-device-id")?.trim() || "missing-device";
  const network = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown-network";
  return sha256(`${deviceId}|${network}`);
}

export async function recordTelemetryRequest(data: {
  sensorDeviceId?: string;
  identifierHash: string;
  outcome: string;
  reasonCode?: string;
  itemCount?: number;
  acceptedCount?: number;
  duplicateCount?: number;
  rejectedCount?: number;
}) {
  return prisma.deviceTelemetryRequest.create({
    data: {
      sensorDeviceId: data.sensorDeviceId,
      identifierHash: data.identifierHash,
      outcome: data.outcome,
      reasonCode: data.reasonCode,
      itemCount: data.itemCount ?? 0,
      acceptedCount: data.acceptedCount ?? 0,
      duplicateCount: data.duplicateCount ?? 0,
      rejectedCount: data.rejectedCount ?? 0,
    },
  });
}

export type AuthenticatedTelemetryDevice = Awaited<ReturnType<typeof authenticateTelemetryDevice>>;

export async function authenticateTelemetryDevice(request: Request) {
  const deviceId = request.headers.get("x-device-id")?.trim();
  const token = bearerToken(request);
  const identifierHash = telemetryIdentifierHash(request);
  const since = new Date(Date.now() - 60_000);
  const recentCount = await prisma.deviceTelemetryRequest.count({ where: { identifierHash, createdAt: { gte: since } } });

  if (recentCount >= TELEMETRY_RATE_LIMIT_PER_MINUTE) {
    await recordTelemetryRequest({ identifierHash, outcome: "REJECTED", reasonCode: "RATE_LIMITED" });
    throw new TelemetryAuthError("Limite de requisições excedido.", 429, "RATE_LIMITED");
  }

  if (!deviceId || !token) {
    await recordTelemetryRequest({ identifierHash, outcome: "REJECTED", reasonCode: "AUTH_REQUIRED" });
    throw new TelemetryAuthError("Credencial do dispositivo obrigatória.", 401, "AUTH_REQUIRED");
  }

  const device = await prisma.sensorDevice.findUnique({
    where: { id: deviceId },
    include: { thermalPoint: { select: { id: true, code: true, active: true, monitoringMode: true, sampleIntervalSec: true } } },
  });
  const presentedHash = sha256(token);
  const storedHash = device?.apiKeyHash ?? sha256("invalid-device-dummy-key");

  if (!device || !equalHash(presentedHash, storedHash)) {
    if (device) {
      await prisma.sensorDevice.update({
        where: { id: device.id },
        data: { lastAuthFailureAt: new Date(), consecutiveAuthFailures: { increment: 1 } },
      });
    }
    await recordTelemetryRequest({ sensorDeviceId: device?.id, identifierHash, outcome: "REJECTED", reasonCode: "INVALID_CREDENTIAL" });
    throw new TelemetryAuthError("Credencial do dispositivo inválida.", 401, "INVALID_CREDENTIAL");
  }

  if (["DISABLED", "MAINTENANCE"].includes(device.status) || !device.thermalPoint.active) {
    await recordTelemetryRequest({ sensorDeviceId: device.id, identifierHash, outcome: "REJECTED", reasonCode: "DEVICE_BLOCKED" });
    throw new TelemetryAuthError("Dispositivo não está autorizado a enviar telemetria.", 403, "DEVICE_BLOCKED");
  }

  return { ...device, identifierHash };
}
