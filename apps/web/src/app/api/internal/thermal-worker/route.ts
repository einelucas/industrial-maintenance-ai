import { NextResponse } from "next/server";
import { thermalAnalysisWorkerService } from "@/features/ai-core/services/thermal-analysis-worker.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.TELEMETRY_WORKER_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const report = await thermalAnalysisWorkerService.reconcileAndRun({ maxJobs: 100, concurrency: 8, timeBudgetMs: 50_000 });
  return NextResponse.json(report, { status: report.worker.stoppedReason ? 202 : 200 });
}
