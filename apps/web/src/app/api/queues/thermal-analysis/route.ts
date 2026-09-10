import { handleCallback, send } from "@vercel/queue";
import { thermalAnalysisWorkerService } from "@/features/ai-core/services/thermal-analysis-worker.service";
import { THERMAL_ANALYSIS_QUEUE_TOPIC } from "@/features/telemetry/services/thermal-queue-publisher.service";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ThermalAnalysisMessage {
  schemaVersion: number;
  requestedJobs: number;
  drainBacklog?: boolean;
  runId?: string;
  batch?: number;
  initiatedById?: string;
}

const queueCallback = handleCallback<ThermalAnalysisMessage>(
  async (message) => {
    if (message?.schemaVersion !== 1) throw new Error("Mensagem de análise térmica incompatível.");
    const maxJobs = Math.min(500, Math.max(55, Number(message.requestedJobs) || 55));
    const report = await thermalAnalysisWorkerService.reconcileAndRun({ maxJobs, concurrency: 8, timeBudgetMs: 50_000 });
    if (report.worker.stoppedReason?.startsWith("Núcleo de IA indisponível")) {
      throw new Error(report.worker.stoppedReason);
    }
    if (message.drainBacklog && message.runId) {
      const batch = Math.max(0, Number(message.batch) || 0);
      if (report.backlog.remainingCount > 0) {
        // Quando só restam retries com `availableAt` no futuro, reutilizamos
        // o retry/backoff da própria mensagem em vez de criar uma cadeia
        // imediata sem progresso.
        if (report.worker.processedCount === 0) {
          throw new Error("Backfill aguardando a janela de retry dos itens pendentes.");
        }
        await send(
          THERMAL_ANALYSIS_QUEUE_TOPIC,
          { ...message, batch: batch + 1 },
          { idempotencyKey: `thermal-backfill-${message.runId}-${batch + 1}`, retentionSeconds: 86_400 },
        );
      } else {
        await prisma.auditLog.create({
          data: {
            userId: message.initiatedById ?? null,
            entity: "InferenceRequest",
            entityId: message.runId,
            action: "THERMAL_BACKFILL_COMPLETED",
            metadata: JSON.parse(JSON.stringify({ batch, backlog: report.backlog, worker: report.worker })),
          },
        });
      }
    }
  },
  {
    visibilityTimeoutSeconds: 60,
    retry: (_error, metadata) => metadata.deliveryCount > 10
      ? { acknowledge: true }
      : { afterSeconds: Math.min(300, 5 * 2 ** Math.max(0, metadata.deliveryCount - 1)) },
  },
);

// Adaptador explícito para o contrato de App Routes do Next 14. O SDK também
// aceita `{ request }` para outros runtimes, união que o validador de rotas do
// Next não reconhece quando o callback é exportado diretamente.
export function POST(request: Request) {
  return queueCallback(request);
}
