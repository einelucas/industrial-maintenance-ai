import { maintenancePlanService } from "@/features/maintenance-plans/services/maintenance-plan.service";
import { thermalBackfillService } from "@/features/ai-core/services/thermal-backfill.service";

type JobStatus = "SUCCEEDED" | "BLOCKED" | "FAILED";

export interface DailyAutomationReport {
  status: "SUCCEEDED" | "PARTIAL_FAILURE" | "FAILED";
  ranAt: string;
  preventive: {
    status: JobStatus;
    generatedCount: number;
    generated: Awaited<ReturnType<typeof maintenancePlanService.runScheduledGeneration>>;
    error?: string;
  };
  thermal: {
    status: JobStatus;
    report?: Awaited<ReturnType<typeof thermalBackfillService.run>>;
    error?: string;
  };
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Falha não identificada.";
}

/**
 * Única automação diária registrada na Vercel. As duas rotinas são isoladas:
 * uma falha não impede a execução nem o diagnóstico explícito da outra.
 */
export async function runDailyAutomation(): Promise<DailyAutomationReport> {
  let preventive: DailyAutomationReport["preventive"];
  let thermal: DailyAutomationReport["thermal"];

  try {
    const generated = await maintenancePlanService.runScheduledGeneration();
    preventive = { status: "SUCCEEDED", generatedCount: generated.length, generated };
  } catch (error) {
    preventive = { status: "FAILED", generatedCount: 0, generated: [], error: safeMessage(error) };
  }

  try {
    const report = await thermalBackfillService.run({ dryRun: false });
    thermal = {
      status: report.stoppedReason ? "BLOCKED" : "SUCCEEDED",
      report,
      ...(report.stoppedReason ? { error: report.stoppedReason } : {}),
    };
  } catch (error) {
    thermal = { status: "FAILED", error: safeMessage(error) };
  }

  const jobStatuses = [preventive.status, thermal.status];
  const status = jobStatuses.every((jobStatus) => jobStatus === "SUCCEEDED")
    ? "SUCCEEDED"
    : jobStatuses.every((jobStatus) => jobStatus === "FAILED")
      ? "FAILED"
      : "PARTIAL_FAILURE";

  return { status, ranAt: new Date().toISOString(), preventive, thermal };
}
