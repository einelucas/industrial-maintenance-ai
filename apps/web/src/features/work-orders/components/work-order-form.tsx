"use client";

import { useFormState } from "react-dom";
import type { Equipment, Sector, User } from "@prisma/client";
import { createWorkOrderAction, type WorkOrderFormState } from "@/features/work-orders/actions/create-work-order.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: WorkOrderFormState = {};

type EquipmentWithSector = Equipment & { sector: Sector };

export function WorkOrderForm({
  equipments,
  technicians,
  defaultEquipmentId,
  defaultType,
  sourcePredictionId,
}: {
  equipments: EquipmentWithSector[];
  technicians: User[];
  defaultEquipmentId?: string;
  defaultType?: string;
  sourcePredictionId?: string;
}) {
  const [state, formAction] = useFormState(createWorkOrderAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {sourcePredictionId && <input type="hidden" name="sourcePredictionId" value={sourcePredictionId} />}

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="title">Título *</Label>
        <Input id="title" name="title" required placeholder="Ex: Verificar vibração anormal" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" name="description" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="equipmentId">Equipamento *</Label>
        <Select id="equipmentId" name="equipmentId" required defaultValue={defaultEquipmentId ?? ""}>
          <option value="" disabled>
            Selecione...
          </option>
          {equipments.map((equipment) => (
            <option key={equipment.id} value={equipment.id}>
              {equipment.tag} — {equipment.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type">Tipo *</Label>
        <Select id="type" name="type" required defaultValue={defaultType ?? "CORRECTIVE"}>
          <option value="CORRECTIVE">Corretiva</option>
          <option value="PREVENTIVE">Preventiva</option>
          <option value="PREDICTIVE">Preditiva</option>
          <option value="INSPECTION">Inspeção</option>
          <option value="IMPROVEMENT">Melhoria</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="priority">Prioridade *</Label>
        <Select id="priority" name="priority" required defaultValue="MEDIUM">
          <option value="LOW">Baixa</option>
          <option value="MEDIUM">Média</option>
          <option value="HIGH">Alta</option>
          <option value="CRITICAL">Crítica</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assignedUserId">Responsável</Label>
        <Select id="assignedUserId" name="assignedUserId" defaultValue="">
          <option value="">Não atribuído</option>
          {technicians.map((tech) => (
            <option key={tech.id} value={tech.id}>
              {tech.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="estimatedHours">Horas estimadas</Label>
        <Input id="estimatedHours" name="estimatedHours" type="number" step="0.5" min="0" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scheduledStart">Início planejado</Label>
        <Input id="scheduledStart" name="scheduledStart" type="datetime-local" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scheduledEnd">Fim planejado</Label>
        <Input id="scheduledEnd" name="scheduledEnd" type="datetime-local" />
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Criando...">Criar ordem de serviço</SubmitButton>
      </div>
    </form>
  );
}
