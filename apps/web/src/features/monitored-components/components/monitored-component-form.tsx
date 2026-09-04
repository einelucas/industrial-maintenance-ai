"use client";

import { useFormState } from "react-dom";
import type { ElectricalPanel, MonitoredComponent } from "@prisma/client";
import {
  createMonitoredComponentAction,
  type MonitoredComponentFormState,
} from "@/features/monitored-components/actions/create-monitored-component.action";
import { updateMonitoredComponentAction } from "@/features/monitored-components/actions/update-monitored-component.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: MonitoredComponentFormState = {};

const COMPONENT_TYPE_LABEL: Record<string, string> = {
  CIRCUIT_BREAKER: "Disjuntor",
  CONTACTOR: "Contator",
  THERMAL_RELAY: "Relé térmico",
  TERMINAL: "Borne",
  BUSBAR: "Barramento",
  FUSE: "Fusível",
  CABLE_CONNECTION: "Conexão de cabo",
  POWER_SUPPLY: "Fonte de alimentação",
  DRIVE: "Inversor/drive",
  OTHER: "Outro",
};

type Props = { panels: ElectricalPanel[]; defaultPanelId?: string } & (
  | { mode?: "create"; component?: undefined }
  | { mode: "edit"; component: MonitoredComponent }
);

export function MonitoredComponentForm(props: Props) {
  const { panels, defaultPanelId } = props;
  const mode = props.mode ?? "create";
  const component = props.mode === "edit" ? props.component : undefined;
  const action =
    props.mode === "edit" ? updateMonitoredComponentAction.bind(null, props.component.id) : createMonitoredComponentAction;
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="tag">TAG *</Label>
        <Input
          id="tag"
          name="tag"
          required
          placeholder="CMP-AUT-001-1"
          defaultValue={component?.tag}
          readOnly={mode === "edit"}
          className={mode === "edit" ? "bg-muted text-muted-foreground" : undefined}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" required placeholder="Contator principal" defaultValue={component?.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="componentType">Tipo *</Label>
        <Select id="componentType" name="componentType" required defaultValue={component?.componentType ?? ""}>
          <option value="" disabled>
            Selecione...
          </option>
          {Object.entries(COMPONENT_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="panelId">Painel *</Label>
        <Select id="panelId" name="panelId" required defaultValue={component?.panelId ?? defaultPanelId ?? ""}>
          <option value="" disabled>
            Selecione...
          </option>
          {panels.map((panel) => (
            <option key={panel.id} value={panel.id}>
              {panel.tag} — {panel.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phase">Fase</Label>
        <Input id="phase" name="phase" placeholder="R, S, T..." defaultValue={component?.phase ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ratedCurrent">Corrente nominal (A)</Label>
        <Input id="ratedCurrent" name="ratedCurrent" type="number" step="0.1" min="0" defaultValue={component?.ratedCurrent ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="manufacturer">Fabricante</Label>
        <Input id="manufacturer" name="manufacturer" defaultValue={component?.manufacturer ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="model">Modelo</Label>
        <Input id="model" name="model" defaultValue={component?.model ?? ""} />
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-status-neutral sm:col-span-2">
          {mode === "edit" ? "Componente atualizado com sucesso." : "Componente cadastrado com sucesso."}
        </p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Salvando...">{mode === "edit" ? "Salvar alterações" : "Cadastrar componente"}</SubmitButton>
      </div>
    </form>
  );
}
