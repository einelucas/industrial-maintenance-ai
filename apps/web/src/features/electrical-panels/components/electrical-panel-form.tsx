"use client";

import { useFormState } from "react-dom";
import type { ElectricalPanel, Equipment, Sector } from "@prisma/client";
import {
  createElectricalPanelAction,
  type ElectricalPanelFormState,
} from "@/features/electrical-panels/actions/create-electrical-panel.action";
import { updateElectricalPanelAction } from "@/features/electrical-panels/actions/update-electrical-panel.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: ElectricalPanelFormState = {};

const PANEL_TYPE_LABEL: Record<string, string> = {
  MCC: "MCC",
  DISTRIBUTION: "Distribuição",
  CONTROL: "Comando",
  PROTECTION: "Proteção",
  OTHER: "Outro",
};

type Props = { sectors: Sector[]; equipments: Equipment[] } & (
  | { mode?: "create"; panel?: undefined }
  | { mode: "edit"; panel: ElectricalPanel }
);

export function ElectricalPanelForm(props: Props) {
  const { sectors, equipments } = props;
  const mode = props.mode ?? "create";
  const panel = props.mode === "edit" ? props.panel : undefined;
  const action = props.mode === "edit" ? updateElectricalPanelAction.bind(null, props.panel.id) : createElectricalPanelAction;
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="tag">TAG *</Label>
        <Input
          id="tag"
          name="tag"
          required
          placeholder="PNL-AUT-001"
          defaultValue={panel?.tag}
          readOnly={mode === "edit"}
          className={mode === "edit" ? "bg-muted text-muted-foreground" : undefined}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" required placeholder="Painel — Autoclave 01" defaultValue={panel?.name} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" name="description" defaultValue={panel?.description ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="panelType">Tipo *</Label>
        <Select id="panelType" name="panelType" required defaultValue={panel?.panelType ?? ""}>
          <option value="" disabled>
            Selecione...
          </option>
          {Object.entries(PANEL_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="location">Localização</Label>
        <Input id="location" name="location" defaultValue={panel?.location ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sectorId">Setor *</Label>
        <Select id="sectorId" name="sectorId" required defaultValue={panel?.sectorId ?? ""}>
          <option value="" disabled>
            Selecione...
          </option>
          {sectors.map((sector) => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="equipmentId">Equipamento (opcional)</Label>
        <Select id="equipmentId" name="equipmentId" defaultValue={panel?.equipmentId ?? ""}>
          <option value="">Nenhum (painel do setor)</option>
          {equipments.map((equipment) => (
            <option key={equipment.id} value={equipment.id}>
              {equipment.tag} — {equipment.name}
            </option>
          ))}
        </Select>
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-status-neutral sm:col-span-2">
          {mode === "edit" ? "Painel atualizado com sucesso." : "Painel cadastrado com sucesso."}
        </p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Salvando...">{mode === "edit" ? "Salvar alterações" : "Cadastrar painel"}</SubmitButton>
      </div>
    </form>
  );
}
