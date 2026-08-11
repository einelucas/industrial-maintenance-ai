"use client";

import { useFormState } from "react-dom";
import { recordReadingAction, simulateReadingAction, type ReadingFormState } from "@/features/sensor-readings/actions/record-reading.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: ReadingFormState = {};

export function ReadingForm({ equipmentId }: { equipmentId: string }) {
  const [manualState, manualAction] = useFormState(recordReadingAction, initialState);
  const [simState, simAction] = useFormState(simulateReadingAction, initialState);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-3 text-sm font-medium">Registrar medição manual</h3>
        <form action={manualAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="equipmentId" value={equipmentId} />
          <div className="space-y-1">
            <Label htmlFor="temperature">Temperatura (°C)</Label>
            <Input id="temperature" name="temperature" type="number" step="0.1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vibration">Vibração (mm/s)</Label>
            <Input id="vibration" name="vibration" type="number" step="0.1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pressure">Pressão (bar)</Label>
            <Input id="pressure" name="pressure" type="number" step="0.1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rpm">Rotação (RPM)</Label>
            <Input id="rpm" name="rpm" type="number" step="1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="current">Corrente (A)</Label>
            <Input id="current" name="current" type="number" step="0.1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="operatingHours">Horas de operação</Label>
            <Input id="operatingHours" name="operatingHours" type="number" step="1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="airTemperature">Temp. do ar (°C)</Label>
            <Input id="airTemperature" name="airTemperature" type="number" step="0.1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="processTemperature">Temp. do processo (°C)</Label>
            <Input id="processTemperature" name="processTemperature" type="number" step="0.1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rotationalSpeed">Velocidade rotacional (RPM)</Label>
            <Input id="rotationalSpeed" name="rotationalSpeed" type="number" step="1" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="toolWear">Desgaste da ferramenta (min)</Label>
            <Input id="toolWear" name="toolWear" type="number" step="1" />
          </div>
          {manualState.error && <p className="col-span-2 text-sm text-status-critical">{manualState.error}</p>}
          {manualState.success && <p className="col-span-2 text-sm text-status-neutral">Medição registrada e predição calculada.</p>}
          <div className="col-span-2">
            <SubmitButton size="sm" pendingText="Enviando...">Registrar e prever</SubmitButton>
          </div>
        </form>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium">Simulador (desenvolvimento)</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Gera uma leitura fictícia para demonstrar o fluxo IA → Alerta → OS.
        </p>
        <form action={simAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="equipmentId" value={equipmentId} />
          <SubmitButton name="profile" value="NORMAL" variant="outline" size="sm">Gerar leitura Normal</SubmitButton>
          <SubmitButton name="profile" value="ATTENTION" variant="outline" size="sm">Gerar leitura Atenção</SubmitButton>
          <SubmitButton name="profile" value="CRITICAL" variant="outline" size="sm">Gerar leitura Crítica</SubmitButton>
        </form>
        {simState.error && <p className="mt-2 text-sm text-status-critical">{simState.error}</p>}
        {simState.success && <p className="mt-2 text-sm text-status-neutral">Leitura simulada e predição calculada.</p>}
      </div>
    </div>
  );
}
