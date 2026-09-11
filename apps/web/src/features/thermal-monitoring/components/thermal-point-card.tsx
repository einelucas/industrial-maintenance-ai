import Link from "next/link";
import { AlertTriangle, ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnalysisStatusBadge } from "@/components/shared/status-badge";
import { ThermalRiskBadge } from "@/features/thermal-monitoring/components/thermal-status";
import { CompanyPriorityBadge } from "@/features/thermal-priority/components/company-priority-badge";
import { CONNECTIVITY_LABELS, inferenceAge, numeric } from "@/features/thermal-monitoring/services/thermal-presentation";
import type { MonitoringPoint } from "@/features/thermal-monitoring/services/thermal-monitoring.service";
import { formatDateTime } from "@/lib/utils/format";

// Faixa lateral discreta ligada ao RISCO ATUAL da IA — nunca à prioridade
// histórica (que é evidência, não veredito operacional). "Sem análise atual"
// usa a mesma cor neutra/cinza do estado offline, nunca verde.
const RISK_STRIPE: Record<"LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "NONE", string> = {
  LOW: "border-l-status-neutral",
  MODERATE: "border-l-status-attention",
  HIGH: "border-l-status-high",
  CRITICAL: "border-l-status-critical",
  NONE: "border-l-border",
};

const SOURCE_LABELS: Record<string, string> = {
  POINT_SENSOR: "Sensor IoT",
  MANUAL: "Coleta manual",
  CSV: "Importação CSV",
  SIMULATOR: "Simulador",
};

function Trend({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground">Tendência indisponível</span>;
  const Icon = value > 0.05 ? TrendingUp : value < -0.05 ? TrendingDown : Minus;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {numeric(value, " °C/h")}
    </span>
  );
}

export function ThermalPointCard({ point, now }: { point: MonitoringPoint; now: Date }) {
  const reading = point.readings[0];
  const stripe = RISK_STRIPE[point.currentRisk ?? "NONE"];

  return (
    <div className={`relative min-w-0 rounded-lg border border-l-4 bg-card p-4 transition-colors hover:border-primary ${stripe}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-semibold">
          {point.code} · {point.name}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {point.hasOpenIncident && (
            <Badge variant="high" className="gap-1">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Incidente aberto
            </Badge>
          )}
          <ThermalRiskBadge risk={point.currentRisk} />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {point.component.panel.sector.name} / {point.component.panel.equipment?.tag ?? "Painel setorial"} / {point.component.panel.tag} / {point.component.tag}
      </p>
      <div className="my-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          Temperatura: <strong>{numeric(reading?.temperatureMaxC, " °C")}</strong>
        </span>
        <span>
          Referência: <strong>{numeric(reading?.referenceTemperatureC, " °C")}</strong>
        </span>
        <span>
          ΔT: <strong>{numeric(reading?.deltaTC, " °C")}</strong>
        </span>
        <Trend value={point.prediction?.trendCPerHour} />
      </div>
      <div className="flex flex-wrap gap-2">
        {reading ? <AnalysisStatusBadge status={reading.analysisStatus} /> : <Badge variant="muted">Sem leitura</Badge>}
        <Badge variant={point.connectivity === "OFFLINE" ? "attention" : "muted"}>{CONNECTIVITY_LABELS[point.connectivity]}</Badge>
        {reading?.source === "SIMULATOR" && <Badge variant="muted">Dados sintéticos</Badge>}
        {point.historicalPriority && <CompanyPriorityBadge priority={point.historicalPriority} prefix="Histórico" />}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Leitura: {formatDateTime(reading?.measuredAt)} ({reading?.source ? SOURCE_LABELS[reading.source] ?? reading.source : "—"}) · Inferência: {inferenceAge(point.prediction?.createdAt, now)}
      </p>
      <div className="mt-3 flex items-center gap-1 text-sm font-medium text-primary" aria-hidden="true">
        Ver detalhes <ChevronRight className="h-4 w-4" />
      </div>
      <Link
        href={`/thermal-monitoring/points/${point.id}`}
        className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Ver detalhes de ${point.code} · ${point.name}`}
      />
    </div>
  );
}
