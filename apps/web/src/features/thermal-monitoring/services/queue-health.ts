export interface QueueMetricsInput {
  pendingRequests: number;
  orphanedReadings: number;
  leasedCount: number;
  failedRequests: number;
  rejectedLastHour: number;
  oldestPendingAt: Date | null;
}

export type QueueHealthLevel = "healthy" | "attention" | "degraded";

// Heurística de saúde OPERACIONAL da fila de ingestão/inferência (throughput,
// falhas, backlog) — não é, e nunca deve virar, uma classificação de risco
// térmico. Os limites abaixo são de apresentação (quando destacar o painel em
// atenção/degradado), não uma regra de negócio sobre equipamentos ou pontos.
const STALE_PENDING_MS = 30 * 60 * 1000;

export function queueHealthState(metrics: QueueMetricsInput, now = new Date()): { state: QueueHealthLevel; reasons: string[] } {
  const reasons: string[] = [];
  const oldestPendingAgeMs = metrics.oldestPendingAt ? now.getTime() - metrics.oldestPendingAt.getTime() : 0;

  if (metrics.failedRequests > 0) reasons.push(`${metrics.failedRequests} requisição(ões) de inferência com falha`);
  if (oldestPendingAgeMs > STALE_PENDING_MS) reasons.push("item pendente há mais de 30 min sem ser processado");
  if (reasons.length > 0) return { state: "degraded", reasons };

  if (metrics.pendingRequests > 0 || metrics.orphanedReadings > 0 || metrics.leasedCount > 0) {
    reasons.push("há leituras aguardando ou em processamento pela IA");
  }
  if (metrics.rejectedLastHour > 0) reasons.push(`${metrics.rejectedLastHour} leitura(s) rejeitada(s) na última hora`);
  if (reasons.length > 0) return { state: "attention", reasons };

  return { state: "healthy", reasons: [] };
}
