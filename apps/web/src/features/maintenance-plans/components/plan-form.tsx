"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Plus, X } from "lucide-react";
import type { Equipment, MaintenancePlan, MaintenancePlanChecklistItem, Sector, User } from "@prisma/client";
import { createPlanAction } from "@/features/maintenance-plans/actions/create-plan.action";
import { updatePlanAction, type PlanFormState } from "@/features/maintenance-plans/actions/update-plan.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: PlanFormState = {};

type EquipmentWithSector = Equipment & { sector: Sector };
type PlanWithChecklist = MaintenancePlan & { checklistItems: MaintenancePlanChecklistItem[] };

function toDateInputValue(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

type PlanFormProps = { equipments: EquipmentWithSector[]; planners: User[] } & (
  | { mode?: "create"; plan?: undefined }
  | { mode: "edit"; plan: PlanWithChecklist }
);

export function PlanForm(props: PlanFormProps) {
  const { equipments, planners } = props;
  const mode = props.mode ?? "create";
  const action = props.mode === "edit" ? updatePlanAction.bind(null, props.plan.id) : createPlanAction;
  const plan = props.mode === "edit" ? props.plan : undefined;
  const [state, formAction] = useFormState(action, initialState);

  const [checklistItems, setChecklistItems] = useState<string[]>(
    plan?.checklistItems.map((item) => item.description) ?? []
  );

  const equipment = plan ? equipments.find((e) => e.id === plan.equipmentId) : undefined;

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" required placeholder="Lubrificação mensal" defaultValue={plan?.name} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" name="description" defaultValue={plan?.description ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="equipmentId">Equipamento *</Label>
        {plan ? (
          <Input
            value={equipment ? `${equipment.tag} — ${equipment.name}` : plan.equipmentId}
            readOnly
            className="bg-muted text-muted-foreground"
          />
        ) : (
          <Select id="equipmentId" name="equipmentId" required defaultValue="">
            <option value="" disabled>Selecione...</option>
            {equipments.map((eq) => (
              <option key={eq.id} value={eq.id}>{eq.tag} — {eq.name}</option>
            ))}
          </Select>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="frequencyType">Frequência *</Label>
        <Select id="frequencyType" name="frequencyType" required defaultValue={plan?.frequencyType ?? "MONTHLY"}>
          <option value="DAILY">Diária</option>
          <option value="WEEKLY">Semanal</option>
          <option value="MONTHLY">Mensal</option>
          <option value="QUARTERLY">Trimestral</option>
          <option value="SEMIANNUAL">Semestral</option>
          <option value="ANNUAL">Anual</option>
          <option value="CUSTOM_DAYS">Personalizada (dias)</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="frequencyValue">Valor da frequência</Label>
        <Input id="frequencyValue" name="frequencyValue" type="number" min="1" defaultValue={plan?.frequencyValue ?? 1} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nextExecution">Próxima execução *</Label>
        <Input
          id="nextExecution"
          name="nextExecution"
          type="date"
          required
          defaultValue={plan ? toDateInputValue(plan.nextExecution) : undefined}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="estimatedHours">Horas estimadas</Label>
        <Input id="estimatedHours" name="estimatedHours" type="number" step="0.5" min="0" defaultValue={plan?.estimatedHours ?? ""} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="defaultAssigneeId">Responsável padrão</Label>
        <Select id="defaultAssigneeId" name="defaultAssigneeId" defaultValue={plan?.defaultAssigneeId ?? ""}>
          <option value="">Não definido</option>
          {planners.map((user) => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label>Checklist</Label>
        <p className="text-xs text-muted-foreground">
          Copiado para cada OS gerada a partir deste plano. Alterar aqui não afeta OS já geradas.
        </p>
        <div className="space-y-2">
          {checklistItems.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                name="checklistItems"
                value={item}
                placeholder="Ex.: Verificar temperatura de operação"
                onChange={(e) => {
                  const value = e.target.value;
                  setChecklistItems((prev) => prev.map((it, i) => (i === index ? value : it)));
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remover item"
                onClick={() => setChecklistItems((prev) => prev.filter((_, i) => i !== index))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setChecklistItems((prev) => [...prev, ""])}>
            <Plus className="h-4 w-4" /> Adicionar item
          </Button>
        </div>
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-status-neutral sm:col-span-2">
          {mode === "edit" ? "Plano atualizado com sucesso." : "Plano criado com sucesso."}
        </p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Salvando...">{mode === "edit" ? "Salvar alterações" : "Criar plano"}</SubmitButton>
      </div>
    </form>
  );
}
