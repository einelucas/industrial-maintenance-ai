"use client";

import { useFormState } from "react-dom";
import type { Equipment, Sector } from "@prisma/client";
import { createEquipmentAction } from "@/features/equipments/actions/create-equipment.action";
import { updateEquipmentAction, type EquipmentFormState } from "@/features/equipments/actions/update-equipment.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: EquipmentFormState = {};

function toDateInputValue(date: Date | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

type EquipmentFormProps = { sectors: Sector[] } & (
  | { mode?: "create"; equipment?: undefined }
  | { mode: "edit"; equipment: Equipment }
);

export function EquipmentForm(props: EquipmentFormProps) {
  const { sectors } = props;
  const mode = props.mode ?? "create";
  const action = props.mode === "edit" ? updateEquipmentAction.bind(null, props.equipment.id) : createEquipmentAction;
  const equipment = props.mode === "edit" ? props.equipment : undefined;
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="tag">TAG *</Label>
        <Input
          id="tag"
          name="tag"
          required
          placeholder="MTR-001"
          defaultValue={equipment?.tag}
          readOnly={mode === "edit"}
          className={mode === "edit" ? "bg-muted text-muted-foreground" : undefined}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" required placeholder="Motor de Indução 50cv" defaultValue={equipment?.name} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" name="description" defaultValue={equipment?.description ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category">Categoria *</Label>
        <Input id="category" name="category" required placeholder="Motor, Bomba, Compressor..." defaultValue={equipment?.category} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sectorId">Setor *</Label>
        <Select id="sectorId" name="sectorId" required defaultValue={equipment?.sectorId ?? ""}>
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
        <Label htmlFor="manufacturer">Fabricante</Label>
        <Input id="manufacturer" name="manufacturer" defaultValue={equipment?.manufacturer ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="model">Modelo</Label>
        <Input id="model" name="model" defaultValue={equipment?.model ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="serialNumber">Número de série</Label>
        <Input id="serialNumber" name="serialNumber" defaultValue={equipment?.serialNumber ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="location">Localização</Label>
        <Input id="location" name="location" defaultValue={equipment?.location ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="criticality">Criticidade *</Label>
        <Select id="criticality" name="criticality" required defaultValue={equipment?.criticality ?? "MEDIUM"}>
          <option value="LOW">Baixa</option>
          <option value="MEDIUM">Média</option>
          <option value="HIGH">Alta</option>
          <option value="CRITICAL">Crítica</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="status">Status *</Label>
        <Select id="status" name="status" required defaultValue={equipment?.status ?? "OPERATIONAL"}>
          <option value="OPERATIONAL">Operacional</option>
          <option value="MAINTENANCE">Em manutenção</option>
          <option value="STOPPED">Parado</option>
          <option value="INACTIVE">Inativo</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="installationDate">Data de instalação</Label>
        <Input id="installationDate" name="installationDate" type="date" defaultValue={toDateInputValue(equipment?.installationDate)} />
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-status-neutral sm:col-span-2">
          {mode === "edit" ? "Equipamento atualizado com sucesso." : "Equipamento cadastrado com sucesso."}
        </p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Salvando...">{mode === "edit" ? "Salvar alterações" : "Cadastrar equipamento"}</SubmitButton>
      </div>
    </form>
  );
}
