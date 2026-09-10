"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { sensorDeviceService } from "@/features/sensor-devices/services/sensor-device.service";

export async function setSensorDeviceMaintenanceAction(formData: FormData) {
  const actor = await requirePermission("device:manage");
  const deviceId = String(formData.get("deviceId") ?? "");
  const maintenance = String(formData.get("maintenance")) === "true";
  const device = await sensorDeviceService.setMaintenance(deviceId, maintenance);
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      entity: "SensorDevice",
      entityId: device.id,
      action: maintenance ? "ENTER_MAINTENANCE" : "LEAVE_MAINTENANCE",
      metadata: { status: device.status },
    },
  });
  revalidatePath(`/sensor-devices/${device.id}`);
  revalidatePath("/sensor-devices");
}
