"use client";

import { useFormState } from "react-dom";
import type { ThermalPoint } from "@prisma/client";
import {
  runThermalReadingSimulatorAction,
  runPlantDemoAction,
  type RunPlantDemoFormState,
  type RunThermalReadingSimulatorFormState,
} from "@/features/thermal-readings/actions/run-thermal-reading-simulator.action";
import { SIMULATOR_SCENARIOS } from "@/lib/thermal-simulation/reading-scenarios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const initialState: RunThermalReadingSimulatorFormState = {};
const initialPlantState: RunPlantDemoFormState = {};

const SCENARIO_LABEL: Record<(typeof SIMULATOR_SCENARIOS)[number], string> = {
  NORMAL_LOW_LOAD: "Normal sob baixa carga",
  NORMAL_HIGH_LOAD: "Normal sob alta carga",
  PROGRESSIVE_HEATING: "Aquecimento progressivo",
  OVERLOAD: "Sobrecarga",
  DEGRADED_CONNECTION: "Conexão degradada (telemetria)",
  CRITICAL_75_6: "Crítico 75,6 °C (caso oficial)",
  POST_MAINTENANCE_RECOVERY: "Recuperação após manutenção",
  SENSOR_OFFLINE: "Sensor offline",
  INVALID_SENSOR: "Sensor inválido (deve ser rejeitado)",
};

export function ThermalReadingSimulatorForm({ points }: { points: ThermalPoint[] }) {
  const [state, formAction] = useFormState(runThermalReadingSimulatorAction, initialState);
  const [plantState, plantFormAction] = useFormState(runPlantDemoAction, initialPlantState);

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
        <div>
          <h2 className="font-semibold">Cenário completo GPMS 2026</h2>
          <p className="text-sm text-muted-foreground">
            Gera uma janela sincronizada dos 55 pontos, com sinais térmicos sintéticos de defeito em 19 deles, e envia as 55 leituras atuais ao modelo real. Nenhum risco ou resultado é pré-gravado.
          </p>
        </div>
        <form action={plantFormAction}>
          <SubmitButton pendingText="Simulando e analisando...">Simular planta e analisar agora</SubmitButton>
        </form>
        {plantState.error && <p className="text-sm text-status-critical">{plantState.error}</p>}
        {plantState.result && (
          <div className="space-y-1 text-sm">
            <p><strong>{plantState.result.acceptedCount}</strong> medições persistidas ({plantState.result.samplesPerPoint} por ponto).</p>
            <p>Leituras atuais analisadas: <strong>{plantState.result.analysis.succeededCount}/{plantState.result.pointCount}</strong>.</p>
            <p>Pontos classificados com risco atual: <strong>{plantState.result.detectedRiskPointCount}/{plantState.result.pointCount}</strong>.</p>
            <p>Gabarito reservado da simulação: <strong>{plantState.result.expectedAnomalousPointCount}</strong> pontos com degradação. Caso crítico: <strong>{plantState.result.officialCriticalPointCode}</strong>.</p>
            {plantState.result.analysis.stoppedReason && <p className="text-status-critical">{plantState.result.analysis.stoppedReason}</p>}
          </div>
        )}
      </div>

      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="thermalPointId">Ponto termográfico *</Label>
          <Select id="thermalPointId" name="thermalPointId" required defaultValue="">
            <option value="" disabled>
              Selecione...
            </option>
            {points.map((point) => (
              <option key={point.id} value={point.id}>
                {point.code} — {point.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scenario">Cenário *</Label>
          <Select id="scenario" name="scenario" required defaultValue="">
            <option value="" disabled>
              Selecione...
            </option>
            {SIMULATOR_SCENARIOS.map((scenario) => (
              <option key={scenario} value={scenario}>
                {SCENARIO_LABEL[scenario]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seed">Seed (determinismo)</Label>
          <Input id="seed" name="seed" type="number" min="0" step="1" defaultValue="1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sampleCount">Quantidade de amostras</Label>
          <Input id="sampleCount" name="sampleCount" type="number" min="1" max="500" step="1" defaultValue="24" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="intervalMinutes">Intervalo entre amostras (min)</Label>
          <Input id="intervalMinutes" name="intervalMinutes" type="number" min="1" step="1" defaultValue="15" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="referenceTemperatureC">Temperatura de referência (°C, opcional)</Label>
          <Input id="referenceTemperatureC" name="referenceTemperatureC" type="number" step="0.1" />
        </div>

        {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}

        <div className="sm:col-span-2">
          <SubmitButton pendingText="Gerando...">Executar simulação</SubmitButton>
        </div>
      </form>

      {state.result && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              Cenário: <strong>{SCENARIO_LABEL[state.result.scenario]}</strong>
            </span>
            <span>
              Ponto: <strong className="font-mono">{state.result.thermalPointCode}</strong>
            </span>
            <span>
              Geradas: <strong>{state.result.totalGenerated}</strong>
            </span>
            <span className="text-status-neutral">
              Persistidas: <strong>{state.result.acceptedCount}</strong>
            </span>
            <span className="text-status-critical">
              Rejeitadas: <strong>{state.result.rejectedCount}</strong>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Gravado pelo mesmo caminho real de ingestão (mesmo service do registro manual e da importação CSV), com status{" "}
            <strong>PENDING_AI</strong>. Nenhuma <code>Prediction</code>, risco ou incidente foi criado por esta execução.
          </p>
          {state.result.rejected.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amostra</TableHead>
                  <TableHead>Motivo da rejeição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.result.rejected.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.rowNumber ?? "—"}</TableCell>
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
