import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONNECTIVITY_LABELS, RISK_LABELS, connectivitySummary, type Connectivity } from "@/features/thermal-monitoring/services/thermal-presentation";
import { queueHealthState, type QueueMetricsInput } from "@/features/thermal-monitoring/services/queue-health";
import { formatDateTime } from "@/lib/utils/format";
import type { AiCoreStateStatus } from "@/features/ai-core/services/ai-core-state.service";

const QUEUE_STATE_META = {
  healthy: { label: "Saudável", variant: "neutral" as const, icon: CheckCircle2 },
  attention: { label: "Atenção", variant: "attention" as const, icon: AlertTriangle },
  degraded: { label: "Degradado", variant: "critical" as const, icon: AlertOctagon },
};

export function OperationalHealthPanel({
  queueMetrics,
  aiStatus,
  riskCounts,
  totalPoints,
  connectivityPoints,
  aiFailedReadings,
  now,
}: {
  queueMetrics: QueueMetricsInput & { receivedLastHour: number; persistedLastHour: number; analyzedLastHour: number; duplicateLastHour: number; telemetryRequestsLastHour: number };
  aiStatus: AiCoreStateStatus;
  riskCounts: Record<"LOW" | "MODERATE" | "HIGH" | "CRITICAL", number>;
  totalPoints: number;
  connectivityPoints: { connectivity: Connectivity }[];
  aiFailedReadings?: number;
  now: Date;
}) {
  const health = queueHealthState(queueMetrics, now);
  const meta = QUEUE_STATE_META[health.state];
  const processedPct = queueMetrics.receivedLastHour > 0 ? `${Math.round((queueMetrics.persistedLastHour / queueMetrics.receivedLastHour) * 100)}%` : "—";
  const connectivity = connectivitySummary(connectivityPoints);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Saúde da operação</CardTitle>
        <Badge variant={meta.variant} className="gap-1">
          <meta.icon className="h-3.5 w-3.5" aria-hidden="true" /> Fila: {meta.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {health.reasons.length > 0 && (
          <p role={health.state === "degraded" ? "alert" : "status"} className="text-sm text-muted-foreground">
            {health.reasons.join(" · ")}
          </p>
        )}
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
          <div><dt className="text-xs text-muted-foreground">Recebidas (1h)</dt><dd className="font-semibold">{queueMetrics.receivedLastHour}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Persistidas (1h)</dt><dd className="font-semibold">{queueMetrics.persistedLastHour}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Analisadas (1h)</dt><dd className="font-semibold">{queueMetrics.analyzedLastHour}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Pendentes</dt><dd className="font-semibold">{queueMetrics.pendingRequests}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Em processamento</dt><dd className="font-semibold">{queueMetrics.leasedCount}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Falhas</dt><dd className="font-semibold">{queueMetrics.failedRequests}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Rejeições (1h)</dt><dd className="font-semibold">{queueMetrics.rejectedLastHour}</dd></div>
          <div><dt className="text-xs text-muted-foreground">% processado (1h)</dt><dd className="font-semibold">{processedPct}</dd></div>
          <div className="col-span-2"><dt className="text-xs text-muted-foreground">Item pendente mais antigo</dt><dd className="font-semibold">{formatDateTime(queueMetrics.oldestPendingAt)}</dd></div>
        </dl>
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-primary">Detalhes técnicos da fila</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Leituras históricas aguardando (sem requisição): {queueMetrics.orphanedReadings} · Leituras com falha isolada na IA: {aiFailedReadings ?? 0} · Duplicadas (1h): {queueMetrics.duplicateLastHour} · Requisições de telemetria (1h): {queueMetrics.telemetryRequestsLastHour}
          </p>
        </details>

        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Distribuição do risco atual</p>
            <ul className="mt-2 space-y-1 text-sm">
              {Object.entries(RISK_LABELS).map(([risk, label]) => (
                <li key={risk} className="flex items-center justify-between">
                  <span>{label}</span>
                  <span className="font-semibold">{aiStatus === "READY" ? riskCounts[risk as keyof typeof riskCounts] : "Indisponível"}</span>
                </li>
              ))}
              <li className="flex items-center justify-between text-muted-foreground">
                <span>Total monitorado</span>
                <span className="font-semibold">{totalPoints}</span>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conectividade</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(Object.entries(CONNECTIVITY_LABELS) as [Connectivity, string][]).map(([key, label]) => (
                <li key={key} className="flex items-center justify-between">
                  <span>{label}</span>
                  <span className="font-semibold">{connectivity[key]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
