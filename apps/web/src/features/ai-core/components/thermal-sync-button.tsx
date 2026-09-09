"use client";

import { useFormState } from "react-dom";
import { runThermalSyncAction, type RunThermalSyncState } from "@/features/ai-core/actions/run-thermal-sync.action";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: RunThermalSyncState = {};

export function ThermalSyncButton() {
  const [state, action] = useFormState(runThermalSyncAction, initialState);
  return (
    <div className="space-y-1 text-right">
      <form action={action}>
        <SubmitButton pendingText="Sincronizando análises...">Sincronizar análises agora</SubmitButton>
      </form>
      {state.error && <p className="max-w-sm text-xs text-status-critical">{state.error}</p>}
      {state.report && (
        <p className="max-w-sm text-xs text-muted-foreground">
          Leituras atuais processadas: {state.report.processedCount} · Sucesso: {state.report.succeededCount} · Falhas: {state.report.failedCount}
          {state.report.stoppedReason ? ` · ${state.report.stoppedReason}` : ""}
        </p>
      )}
    </div>
  );
}
