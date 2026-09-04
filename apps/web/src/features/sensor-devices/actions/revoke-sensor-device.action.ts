"use server";

import { revalidatePath } from "next/cache";
import { sensorDeviceService } from "@/features/sensor-devices/services/sensor-device.service";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function revokeSensorDeviceAction(formData: FormData) {
  const actor = await requirePermission("device:manage");
  const deviceId = formData.get("deviceId") as string;

  const device = await sensorDeviceService.revoke(deviceId);

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      entity: "SensorDevice",
      entityId: device.id,
      action: "REVOKE",
      metadata: { serialNumber: device.serialNumber },
    },
  });

  revalidatePath("/sensor-devices");
  revalidatePath(`/sensor-devices/${deviceId}`);
}
