"use server";

import { revalidatePath } from "next/cache";
import { sensorDeviceService } from "@/features/sensor-devices/services/sensor-device.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";
import type { ProvisionSensorDeviceState } from "@/features/sensor-devices/actions/provision-sensor-device.action";

/**
 * "Reativar" um dispositivo revogado sempre gera uma credencial NOVA (nunca
 * reaproveita o hash antigo) — ver política documentada em
 * sensor-device.service.ts.
 */
export async function reprovisionSensorDeviceAction(
  id: string,
  _prevState: ProvisionSensorDeviceState,
  _formData: FormData
): Promise<ProvisionSensorDeviceState> {
  try {
    const user = await requirePermission("device:manage");

    const { device, apiKey } = await sensorDeviceService.reprovision(id);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "SensorDevice",
        entityId: device.id,
        action: "REPROVISION",
        metadata: { serialNumber: device.serialNumber },
      },
    });

    revalidatePath("/sensor-devices");
    revalidatePath(`/sensor-devices/${id}`);
    return { apiKey, serialNumber: device.serialNumber };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
