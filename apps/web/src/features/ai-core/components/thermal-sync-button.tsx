"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface BackfillResponse {
  mode: "LOCAL" | "QUEUE";
  runId: string;
  batch: number;
  backlog: { orphanedCount: number; queuedCount: number; failedCount: number; remainingCount: number };
  worker?: { processedCount: number; succeededCount: number; failedCount: number; stoppedReason?: string };
  error?: string;
}

export function ThermalSyncButton() {
  const router = useRouter();
  const stopRequested = useRef(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startBackfill() {
    setRunning(true);
    setError(null);
    stopRequested.current = false;
    // Identificador estável: cliques repetidos no mesmo cenário são
    // deduplicados pela fila e o worker PostgreSQL continua idempotente.
    const runId = "reserved-plant-scenario-v1";
    let batch = 0;
    let totalProcessed = 0;
    let stagnantBatches = 0;
    try {
      while (!stopRequested.current) {
        const response = await fetch("/api/internal/thermal-backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId, batch }),
        });
        const result = await response.json() as BackfillResponse;
        if (!response.ok) throw new Error(result.error || `Processamento retornou HTTP ${response.status}.`);

        if (result.mode === "QUEUE") {
          setMessage(`Processamento completo iniciado em background. Restantes: ${result.backlog.remainingCount}.`);
          break;
        }

        const processedNow = result.worker?.processedCount ?? 0;
        totalProcessed += processedNow;
        setMessage(`Lote ${batch + 1} · processadas nesta execução: ${totalProcessed} · restantes: ${result.backlog.remainingCount} · falhas isoladas: ${result.backlog.failedCount}.`);
        if (result.backlog.remainingCount === 0) {
          setMessage(`Processamento concluído · ${totalProcessed} leituras tratadas nesta execução · falhas isoladas: ${result.backlog.failedCount}.`);
          router.refresh();
          break;
        }
        if (result.worker?.stoppedReason?.startsWith("Núcleo de IA indisponível")) {
          throw new Error(result.worker.stoppedReason);
        }
        stagnantBatches = processedNow === 0 ? stagnantBatches + 1 : 0;
        if (stagnantBatches >= 12) throw new Error("A fila não avançou por um minuto. Verifique a IA e tente continuar.");
        if (processedNow === 0) await new Promise((resolve) => setTimeout(resolve, 5_000));
        batch++;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao processar o histórico.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-1 text-right">
      <Button type="button" onClick={startBackfill} disabled={running}>
        {running ? "Processando histórico…" : "Processar todas as análises"}
      </Button>
      {running && <p className="max-w-md text-xs text-muted-foreground">O processamento continuará em lotes. No localhost, mantenha esta aba aberta.</p>}
      {message && <p role="status" className="max-w-md text-xs text-muted-foreground">{message}</p>}
      {error && <p role="alert" className="max-w-md text-xs text-status-critical">{error}</p>}
    </div>
  );
}
