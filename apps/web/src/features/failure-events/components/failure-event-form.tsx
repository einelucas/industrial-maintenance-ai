"use client";

import { useFormState } from "react-dom";
import {
  registerFailureEventAction,
  type FailureEventFormState,
} from "@/features/failure-events/actions/register-failure-event.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: FailureEventFormState = {};

export function FailureEventForm({
  equipmentId,
  workOrders,
}: {
  equipmentId: string;
  workOrders: { id: string; number: string }[];
}) {
  const [state, formAction] = useFormState(registerFailureEventAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <div className="space-y-1">
        <Label htmlFor="occurredAt">Data/hora da falha *</Label>
        <Input id="occurredAt" name="occurredAt" type="datetime-local" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="workOrderId">OS relacionada</Label>
        <Select id="workOrderId" name="workOrderId" defaultValue="">
          <option value="">Nenhuma</option>
          {workOrders.map((wo) => (
            <option key={wo.id} value={wo.id}>
              {wo.number}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" name="description" placeholder="O que aconteceu..." />
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}
      {state.success && <p className="text-sm text-status-neutral sm:col-span-2">Falha registrada com sucesso.</p>}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Registrando...">Registrar falha real</SubmitButton>
      </div>
    </form>
  );
}
