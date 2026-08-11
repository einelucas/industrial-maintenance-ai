"use client";

import { useFormState } from "react-dom";
import { importReadingsCsvAction, type CsvImportFormState } from "@/features/sensor-readings/actions/import-readings-csv.action";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: CsvImportFormState = {};

export function CsvImportForm({ equipmentId }: { equipmentId: string }) {
  const [state, formAction] = useFormState(importReadingsCsvAction.bind(null, equipmentId), initialState);

  return (
    <div>
      <h3 className="mb-1 text-sm font-medium">Importar leituras via CSV</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Colunas esperadas: <code>measuredAt,temperature,vibration,pressure,rpm,current,torque,operatingHours</code> (a
        primeira linha é o cabeçalho; campos numéricos podem ficar em branco). Leituras importadas via CSV não
        disparam predição automática.
      </p>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="file">Arquivo CSV</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="block text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
        <SubmitButton size="sm" pendingText="Importando...">Importar</SubmitButton>
      </form>

      {state.error && <p className="mt-2 text-sm text-status-critical">{state.error}</p>}
      {state.result && (
        <div className="mt-2 text-sm">
          <p className="text-status-neutral">{state.result.imported} leitura(s) importada(s) com sucesso.</p>
          {state.result.errors.length > 0 && (
            <div className="mt-1 text-status-critical">
              <p>{state.result.errors.length} linha(s) ignorada(s):</p>
              <ul className="list-inside list-disc">
                {state.result.errors.slice(0, 10).map((e) => (
                  <li key={e.row}>Linha {e.row}: {e.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
