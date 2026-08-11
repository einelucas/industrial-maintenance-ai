"use server";

import { revalidatePath } from "next/cache";
import { sensorReadingService } from "@/features/sensor-readings/services/sensor-reading.service";
import { simulateReading } from "@/features/sensor-readings/services/sensor-simulator.service";
import type { SimulatorProfile } from "@/features/sensor-readings/schemas/sensor-reading.schema";
import { requireUser } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";

export type ReadingFormState = { error?: string; success?: boolean };

export async function recordReadingAction(_prevState: ReadingFormState, formData: FormData): Promise<ReadingFormState> {
  try {
    await requireUser();
    const raw = Object.fromEntries(formData.entries());
    await sensorReadingService.recordAndPredict({ ...raw, source: "MANUAL" });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/equipments");
  return { success: true };
}

export async function simulateReadingAction(_prevState: ReadingFormState, formData: FormData): Promise<ReadingFormState> {
  try {
    await requireUser();
    const equipmentId = formData.get("equipmentId") as string;
    const profile = formData.get("profile") as SimulatorProfile;

    const values = simulateReading(profile);
    await sensorReadingService.recordAndPredict({ equipmentId, ...values, source: "SIMULATOR" });
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
  revalidatePath("/equipments");
  return { success: true };
}
