"use client";

import { useFormState } from "react-dom";
import {
  importThermalReadingsCsvAction,
  type ImportThermalReadingsCsvFormState,
} from "@/features/thermal-readings/actions/import-thermal-readings-csv.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const initialState: ImportThermalReadingsCsvFormState = {};

export function ThermalReadingCsvImportForm() {
  const [state, formAction] = useFormState(importThermalReadingsCsvAction, initialState);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="file">Arquivo CSV *</Label>
          <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
          <p className="text-xs text-muted-foreground">
            Colunas obrigatórias: <code>codigoPonto</code>, <code>dataHoraMedicao</code>, <code>temperaturaMaximaC</code>. Opcionais:{" "}
            <code>temperaturaMediaC</code>, <code>temperaturaAmbienteC</code>, <code>temperaturaReferenciaC</code>, <code>correnteA</code>,{" "}
            <code>cargaPercentual</code>, <code>emissividade</code>, <code>qualidadeSinal</code>. Separador vírgula ou ponto e vírgula;
            célula vazia é tratada como ausente, nunca como zero.
          </p>
        </div>
        {state.error && <p className="text-sm text-status-critical">{state.error}</p>}
        <SubmitButton pendingText="Importando...">Importar CSV</SubmitButton>
      </form>

      {state.report && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              Linhas no arquivo: <strong>{state.report.totalRows}</strong>
            </span>
            <span className="text-status-neutral">
              Aceitas: <strong>{state.report.acceptedCount}</strong>
            </span>
            <span className="text-status-critical">
              Rejeitadas: <strong>{state.report.rejectedCount}</strong>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Cada leitura aceita foi persistida com status <strong>PENDING_AI</strong> — nenhuma notificação retroativa foi disparada e
            nenhum risco/severidade foi atribuído nesta importação.
          </p>
          {state.report.rejected.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Ponto</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.report.rejected.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.rowNumber ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.thermalPointCode || "—"}</TableCell>
                    <TableCell className="text-xs">{r.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
