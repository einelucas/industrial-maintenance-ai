"use server";

import { revalidatePath } from "next/cache";
import { thermalBackfillService, type BackfillReport } from "@/features/ai-core/services/thermal-backfill.service";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { toActionErrorMessage } from "@/lib/errors";

export type RunThermalSyncState = { error?: string; report?: BackfillReport };

/** Sincronização extraordinária: não altera o cron diário nem cria agenda adicional. */
export async function runThermalSyncAction(
  _previousState: RunThermalSyncState,
  _formData: FormData
): Promise<RunThermalSyncState> {
  try {
    const user = await requirePermission("thermal-reading:simulate");
    const report = await thermalBackfillService.runCurrentReadings();
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "InferenceRequest",
        entityId: "manual-current-sync",
        action: "SYNC_CURRENT_THERMAL_ANALYSIS",
        metadata: JSON.parse(JSON.stringify(report)),
      },
    });
    revalidatePath("/thermal-monitoring", "layout");
    revalidatePath("/thermal-incidents", "layout");
    revalidatePath("/thermal-readings", "layout");
    return { report };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
