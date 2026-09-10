import type { DeviceStatus, DeviceTechnicalAlertType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

function offlineMultiplier(): number {
  const value = Number(process.env.DEVICE_OFFLINE_MULTIPLIER);
  return Number.isFinite(value) && value >= 2 && value <= 20 ? value : 3;
}

function details(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

export const deviceConnectivityService = {
  async reconcile(now = new Date()) {
    const devices = await prisma.sensorDevice.findMany({
      where: {
        status: { notIn: ["DISABLED", "MAINTENANCE"] },
        thermalPoint: { monitoringMode: { in: ["POINT_SENSOR", "THERMAL_ARRAY", "THERMAL_CAMERA"] } },
      },
      include: {
        thermalPoint: { select: { sampleIntervalSec: true } },
        readings: { orderBy: { receivedAt: "desc" }, take: 1, select: { signalQuality: true } },
      },
    });

    let offlineCount = 0;
    let degradedCount = 0;
    let recoveredCount = 0;

    for (const device of devices) {
      const offlineAfterMs = device.thermalPoint.sampleIntervalSec * offlineMultiplier() * 1000;
      const ageMs = device.lastSeenAt ? now.getTime() - device.lastSeenAt.getTime() : Number.POSITIVE_INFINITY;
      const lowSignal = device.readings[0]?.signalQuality != null && device.readings[0]!.signalQuality! < 0.5;
      const desired: DeviceStatus = ageMs > offlineAfterMs
        ? "OFFLINE"
        : device.consecutiveAuthFailures >= 3 || lowSignal
          ? "DEGRADED"
          : "ONLINE";
      const alertType: DeviceTechnicalAlertType | null = desired === "OFFLINE" ? "OFFLINE" : desired === "DEGRADED" ? "DEGRADED" : null;

      await prisma.$transaction(async (tx) => {
        if (device.status !== desired) {
          await tx.sensorDevice.update({ where: { id: device.id }, data: { status: desired } });
          if (desired === "ONLINE") recoveredCount++;
        }

        if (alertType) {
          const existing = await tx.deviceTechnicalAlert.findFirst({
            where: { sensorDeviceId: device.id, type: alertType, status: "OPEN" },
          });
          if (existing) {
            await tx.deviceTechnicalAlert.update({
              where: { id: existing.id },
              data: { lastObservedAt: now, details: details({ ageSeconds: Math.max(0, Math.floor(ageMs / 1000)), lowSignal, consecutiveAuthFailures: device.consecutiveAuthFailures }) },
            });
          } else {
            await tx.deviceTechnicalAlert.create({
              data: {
                sensorDeviceId: device.id,
                type: alertType,
                status: "OPEN",
                openedAt: now,
                lastObservedAt: now,
                details: details({ ageSeconds: Number.isFinite(ageMs) ? Math.max(0, Math.floor(ageMs / 1000)) : null, lowSignal, consecutiveAuthFailures: device.consecutiveAuthFailures }),
              },
            });
          }
          await tx.deviceTechnicalAlert.updateMany({
            where: { sensorDeviceId: device.id, status: "OPEN", type: { not: alertType } },
            data: { status: "RESOLVED", resolvedAt: now, lastObservedAt: now },
          });
        } else {
          await tx.deviceTechnicalAlert.updateMany({
            where: { sensorDeviceId: device.id, status: "OPEN" },
            data: { status: "RESOLVED", resolvedAt: now, lastObservedAt: now },
          });
        }
      });

      if (desired === "OFFLINE") offlineCount++;
      if (desired === "DEGRADED") degradedCount++;
    }

    return { checkedCount: devices.length, offlineCount, degradedCount, recoveredCount };
  },

  listAlerts(sensorDeviceId: string) {
    return prisma.deviceTechnicalAlert.findMany({
      where: { sensorDeviceId },
      orderBy: { openedAt: "desc" },
      take: 50,
    });
  },
};
