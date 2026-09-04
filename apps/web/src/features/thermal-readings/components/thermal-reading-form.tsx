"use client";

import { useFormState } from "react-dom";
import type { ThermalPoint } from "@prisma/client";
import {
  createThermalReadingAction,
  type CreateThermalReadingFormState,
} from "@/features/thermal-readings/actions/create-thermal-reading.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: CreateThermalReadingFormState = {};

function nowLocalDateTime(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function ThermalReadingForm({ points, defaultPointId }: { points: ThermalPoint[]; defaultPointId?: string }) {
  const [state, formAction] = useFormState(createThermalReadingAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="thermalPointId">Ponto termográfico *</Label>
        <Select id="thermalPointId" name="thermalPointId" required defaultValue={defaultPointId ?? ""}>
          <option value="" disabled>
            Selecione...
          </option>
          {points.map((point) => (
            <option key={point.id} value={point.id}>
              {point.code} — {point.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="measuredAt">Data/hora da medição *</Label>
        <Input id="measuredAt" name="measuredAt" type="datetime-local" required defaultValue={nowLocalDateTime()} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="temperatureMaxC">Temperatura máxima (°C) *</Label>
        <Input id="temperatureMaxC" name="temperatureMaxC" type="number" step="0.1" required placeholder="75.6" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="temperatureAverageC">Temperatura média (°C)</Label>
        <Input id="temperatureAverageC" name="temperatureAverageC" type="number" step="0.1" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ambientTemperatureC">Temperatura ambiente (°C)</Label>
        <Input id="ambientTemperatureC" name="ambientTemperatureC" type="number" step="0.1" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="referenceTemperatureC">Temperatura de referência (°C)</Label>
        <Input id="referenceTemperatureC" name="referenceTemperatureC" type="number" step="0.1" />
        <p className="text-xs text-muted-foreground">Usada só para calcular o ΔT — deixe em branco se não houver referência confiável.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="currentA">Corrente (A)</Label>
        <Input id="currentA" name="currentA" type="number" step="0.1" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="loadPercent">Carga (%)</Label>
        <Input id="loadPercent" name="loadPercent" type="number" step="1" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="emissivity">Emissividade</Label>
        <Input id="emissivity" name="emissivity" type="number" step="0.01" min="0.01" max="1" placeholder="0.95" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signalQuality">Qualidade do sinal (0–1)</Label>
        <Input id="signalQuality" name="signalQuality" type="number" step="0.01" min="0" max="1" />
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-status-neutral sm:col-span-2">
          Leitura registrada com sucesso — status: aguardando análise da IA (PENDING_AI).
        </p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Registrando...">Registrar leitura</SubmitButton>
      </div>
    </form>
  );
}
