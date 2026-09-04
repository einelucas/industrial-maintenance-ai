"use client";

import { useFormState } from "react-dom";
import type { ThermalGlobalConfig } from "@prisma/client";
import {
  updateGlobalThermalConfigAction,
  type ThermalConfigFormState,
} from "@/features/thermal-settings/actions/update-global-thermal-config.action";
import { DEFAULT_THERMAL_THRESHOLDS } from "@/features/thermal-settings/services/thermal-config-resolver";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: ThermalConfigFormState = {};

export function GlobalThermalConfigForm({ config }: { config: ThermalGlobalConfig | null }) {
  const [state, formAction] = useFormState(updateGlobalThermalConfigAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="absoluteLimitC">Limite absoluto (°C)</Label>
        <Input
          id="absoluteLimitC"
          name="absoluteLimitC"
          type="number"
          step="0.1"
          required
          defaultValue={config?.absoluteLimitC ?? DEFAULT_THERMAL_THRESHOLDS.absoluteLimitC}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="deltaTAttentionC">ΔT atenção (°C)</Label>
        <Input
          id="deltaTAttentionC"
          name="deltaTAttentionC"
          type="number"
          step="0.1"
          required
          defaultValue={config?.deltaTAttentionC ?? DEFAULT_THERMAL_THRESHOLDS.deltaTAttentionC}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="deltaTHighC">ΔT alto (°C)</Label>
        <Input
          id="deltaTHighC"
          name="deltaTHighC"
          type="number"
          step="0.1"
          required
          defaultValue={config?.deltaTHighC ?? DEFAULT_THERMAL_THRESHOLDS.deltaTHighC}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="deltaTCriticalC">ΔT crítico (°C)</Label>
        <Input
          id="deltaTCriticalC"
          name="deltaTCriticalC"
          type="number"
          step="0.1"
          required
          defaultValue={config?.deltaTCriticalC ?? DEFAULT_THERMAL_THRESHOLDS.deltaTCriticalC}
        />
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-4">{state.error}</p>}
      {state.success && <p className="text-sm text-status-neutral sm:col-span-4">Configuração global salva.</p>}

      <div className="sm:col-span-4">
        <SubmitButton pendingText="Salvando...">Salvar configuração global</SubmitButton>
      </div>
    </form>
  );
}
