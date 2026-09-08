"use server";

import { revalidatePath } from "next/cache";
import { thermalReadingService } from "@/features/thermal-readings/services/thermal-reading.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type CreateThermalReadingFormState = { error?: string; success?: boolean };

export async function createThermalReadingAction(
  _prevState: CreateThermalReadingFormState,
  formData: FormData
): Promise<CreateThermalReadingFormState> {
  try {
    const user = await requirePermission("thermal-reading:create");

    const raw = Object.fromEntries(formData.entries());
    const reading = await thermalReadingService.ingestManual(raw);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "ThermalReading",
        entityId: reading.id,
        action: "CREATE",
        metadata: {
          thermalPointId: reading.thermalPointId,
          source: reading.source,
          temperatureMaxC: reading.temperatureMaxC,
        },
      },
    });

    revalidatePath("/thermal-readings");
    revalidatePath(`/thermal-points/${reading.thermalPointId}`);
    revalidatePath("/thermal-monitoring", "layout");
    return { success: true };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
