"use client";

import { useFormState } from "react-dom";
import { updateRiskThresholdsAction, type RiskThresholdFormState } from "@/features/settings/actions/update-risk-thresholds.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: RiskThresholdFormState = {};

function toPercent(value: number) {
  return Math.round(value * 1000) / 10;
}

export function RiskThresholdForm({ lowMax, moderateMax, highMax }: { lowMax: number; moderateMax: number; highMax: number }) {
  const [state, formAction] = useFormState(updateRiskThresholdsAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="lowMax">Baixo → Moderado (%)</Label>
        <Input id="lowMax" name="lowMax" type="number" step="0.1" min="1" max="98" required defaultValue={toPercent(lowMax)} />
        <p className="text-xs text-muted-foreground">Abaixo deste valor, risco é classificado como Baixo.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="moderateMax">Moderado → Alto (%)</Label>
        <Input id="moderateMax" name="moderateMax" type="number" step="0.1" min="1" max="98" required defaultValue={toPercent(moderateMax)} />
        <p className="text-xs text-muted-foreground">Entre o corte anterior e este, risco é Moderado.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="highMax">Alto → Crítico (%)</Label>
        <Input id="highMax" name="highMax" type="number" step="0.1" min="1" max="98" required defaultValue={toPercent(highMax)} />
        <p className="text-xs text-muted-foreground">Acima deste valor, risco é classificado como Crítico.</p>
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-3">{state.error}</p>}
      {state.success && <p className="text-sm text-status-neutral sm:col-span-3">Faixas de risco atualizadas com sucesso.</p>}

      <div className="sm:col-span-3">
        <SubmitButton pendingText="Salvando...">Salvar faixas de risco</SubmitButton>
      </div>
    </form>
  );
}
