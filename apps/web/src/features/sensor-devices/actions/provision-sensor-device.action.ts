"use server";

import { revalidatePath } from "next/cache";
import { sensorDeviceService } from "@/features/sensor-devices/services/sensor-device.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type ProvisionSensorDeviceState = { error?: string; apiKey?: string; serialNumber?: string };

export async function provisionSensorDeviceAction(
  _prevState: ProvisionSensorDeviceState,
  formData: FormData
): Promise<ProvisionSensorDeviceState> {
  try {
    const user = await requirePermission("device:manage");

    const raw = Object.fromEntries(formData.entries());
    const { device, apiKey } = await sensorDeviceService.provision(raw);

    // Auditoria nunca inclui a chave — só metadados não sensíveis.
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "SensorDevice",
        entityId: device.id,
        action: "PROVISION",
        metadata: { serialNumber: device.serialNumber, thermalPointId: device.thermalPointId },
      },
    });

    revalidatePath("/sensor-devices");
    return { apiKey, serialNumber: device.serialNumber };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
