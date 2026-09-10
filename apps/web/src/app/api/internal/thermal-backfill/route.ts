import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { send } from "@vercel/queue";
import { thermalAnalysisWorkerService } from "@/features/ai-core/services/thermal-analysis-worker.service";
import { THERMAL_ANALYSIS_QUEUE_TOPIC } from "@/features/telemetry/services/thermal-queue-publisher.service";
import { requirePermission } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface BackfillBody {
  runId?: string;
  batch?: number;
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("thermal-reading:simulate");
    const body = await request.json().catch(() => ({})) as BackfillBody;
    const runId = typeof body.runId === "string" && body.runId.length <= 100 ? body.runId : randomUUID();
    const batch = Number.isInteger(body.batch) && body.batch! >= 0 ? body.batch! : 0;

    if (batch === 0) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          entity: "InferenceRequest",
          entityId: runId,
          action: "THERMAL_BACKFILL_STARTED",
        },
      });
    }

    if (process.env.VERCEL_ENV) {
      await send(
        THERMAL_ANALYSIS_QUEUE_TOPIC,
        { schemaVersion: 1, requestedJobs: 500, drainBacklog: true, runId, batch: 0, initiatedById: user.id },
        { idempotencyKey: `thermal-backfill-${runId}-0`, retentionSeconds: 86_400 },
      );
      const backlog = await thermalAnalysisWorkerService.backlogStatus();
      return NextResponse.json({ mode: "QUEUE", runId, batch: 0, backlog }, { status: 202 });
    }

    const report = await thermalAnalysisWorkerService.reconcileAndRun({ maxJobs: 500, concurrency: 12, timeBudgetMs: 50_000 });
    if (report.backlog.remainingCount === 0) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          entity: "InferenceRequest",
          entityId: runId,
          action: "THERMAL_BACKFILL_COMPLETED",
          metadata: JSON.parse(JSON.stringify({ batch, backlog: report.backlog, worker: report.worker })),
        },
      });
    }
    return NextResponse.json({ mode: "LOCAL", runId, batch, ...report }, { status: report.worker.stoppedReason ? 202 : 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao processar o histórico." }, { status: 500 });
  }
}
