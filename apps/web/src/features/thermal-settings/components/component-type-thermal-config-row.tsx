"use client";

import { useFormState } from "react-dom";
import type { ElectricalComponentType, ThermalComponentTypeConfig } from "@prisma/client";
import { updateComponentTypeThermalConfigAction } from "@/features/thermal-settings/actions/update-component-type-thermal-config.action";
import type { ThermalConfigFormState } from "@/features/thermal-settings/actions/update-global-thermal-config.action";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/shared/submit-button";
import { TableCell, TableRow } from "@/components/ui/table";

const initialState: ThermalConfigFormState = {};

export function ComponentTypeThermalConfigRow({
  componentType,
  config,
}: {
  componentType: ElectricalComponentType;
  config: ThermalComponentTypeConfig | undefined;
}) {
  const [state, formAction] = useFormState(updateComponentTypeThermalConfigAction, initialState);

  return (
    <TableRow>
      <TableCell className="font-mono text-xs align-top pt-4">
        {componentType}
        <input type="hidden" name="componentType" form={`ctc-${componentType}`} value={componentType} />
      </TableCell>
      <TableCell colSpan={5} className="p-2">
        <form id={`ctc-${componentType}`} action={formAction} className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-end">
          <Input
            name="absoluteLimitC"
            type="number"
            step="0.1"
            placeholder="Herda"
            defaultValue={config?.absoluteLimitC ?? ""}
            aria-label={`Limite absoluto — ${componentType}`}
          />
          <Input
            name="deltaTAttentionC"
            type="number"
            step="0.1"
            placeholder="Herda"
            defaultValue={config?.deltaTAttentionC ?? ""}
            aria-label={`ΔT atenção — ${componentType}`}
          />
          <Input
            name="deltaTHighC"
            type="number"
            step="0.1"
            placeholder="Herda"
            defaultValue={config?.deltaTHighC ?? ""}
            aria-label={`ΔT alto — ${componentType}`}
          />
          <Input
            name="deltaTCriticalC"
            type="number"
            step="0.1"
            placeholder="Herda"
            defaultValue={config?.deltaTCriticalC ?? ""}
            aria-label={`ΔT crítico — ${componentType}`}
          />
          <SubmitButton pendingText="Salvando..." className="h-9">
            Salvar
          </SubmitButton>
        </form>
        {state.error && <p className="mt-1 text-xs text-status-critical">{state.error}</p>}
      </TableCell>
    </TableRow>
  );
}
