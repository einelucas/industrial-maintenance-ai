"use client";

import { useFormState } from "react-dom";
import type { MonitoredComponent, ThermalPoint } from "@prisma/client";
import { createThermalPointAction, type ThermalPointFormState } from "@/features/thermal-points/actions/create-thermal-point.action";
import { updateThermalPointAction } from "@/features/thermal-points/actions/update-thermal-point.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: ThermalPointFormState = {};

const MONITORING_MODE_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  CSV: "Importação CSV",
  SIMULATOR: "Simulador",
  POINT_SENSOR: "Sensor pontual",
  THERMAL_ARRAY: "Array térmico",
  THERMAL_CAMERA: "Câmera térmica",
};

type Props = { components: MonitoredComponent[]; defaultComponentId?: string } & (
  | { mode?: "create"; point?: undefined }
  | { mode: "edit"; point: ThermalPoint }
);

export function ThermalPointForm(props: Props) {
  const { components, defaultComponentId } = props;
  const mode = props.mode ?? "create";
  const point = props.mode === "edit" ? props.point : undefined;
  const action = props.mode === "edit" ? updateThermalPointAction.bind(null, props.point.id) : createThermalPointAction;
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="code">Código *</Label>
        <Input
          id="code"
          name="code"
          required
          placeholder="TP-056"
          defaultValue={point?.code}
          readOnly={mode === "edit"}
          className={mode === "edit" ? "bg-muted text-muted-foreground" : undefined}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" required placeholder="Ponto termográfico" defaultValue={point?.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="componentId">Componente *</Label>
        <Select id="componentId" name="componentId" required defaultValue={point?.componentId ?? defaultComponentId ?? ""}>
          <option value="" disabled>
            Selecione...
          </option>
          {components.map((component) => (
            <option key={component.id} value={component.id}>
              {component.tag} — {component.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="monitoringMode">Modo de monitoramento *</Label>
        <Select id="monitoringMode" name="monitoringMode" required defaultValue={point?.monitoringMode ?? ""}>
          <option value="" disabled>
            Selecione...
          </option>
          {Object.entries(MONITORING_MODE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="emissivity">Emissividade (0–1)</Label>
        <Input id="emissivity" name="emissivity" type="number" step="0.01" min="0.01" max="1" defaultValue={point?.emissivity ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sampleIntervalSec">Intervalo de amostragem (s)</Label>
        <Input
          id="sampleIntervalSec"
          name="sampleIntervalSec"
          type="number"
          step="1"
          min="1"
          defaultValue={point?.sampleIntervalSec ?? 60}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="referenceDescription">Descrição da referência</Label>
        <Input
          id="referenceDescription"
          name="referenceDescription"
          placeholder="Comparação com componente equivalente saudável"
          defaultValue={point?.referenceDescription ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="absoluteLimitC">Limite absoluto (°C)</Label>
        <Input id="absoluteLimitC" name="absoluteLimitC" type="number" step="0.1" defaultValue={point?.absoluteLimitC ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="deltaTAttentionC">ΔT atenção (°C)</Label>
        <Input id="deltaTAttentionC" name="deltaTAttentionC" type="number" step="0.1" defaultValue={point?.deltaTAttentionC ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="deltaTHighC">ΔT alto (°C)</Label>
        <Input id="deltaTHighC" name="deltaTHighC" type="number" step="0.1" defaultValue={point?.deltaTHighC ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="deltaTCriticalC">ΔT crítico (°C)</Label>
        <Input id="deltaTCriticalC" name="deltaTCriticalC" type="number" step="0.1" defaultValue={point?.deltaTCriticalC ?? ""} />
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-status-neutral sm:col-span-2">
          {mode === "edit" ? "Ponto atualizado com sucesso." : "Ponto cadastrado com sucesso."}
        </p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Salvando...">{mode === "edit" ? "Salvar alterações" : "Cadastrar ponto"}</SubmitButton>
      </div>
    </form>
  );
}
