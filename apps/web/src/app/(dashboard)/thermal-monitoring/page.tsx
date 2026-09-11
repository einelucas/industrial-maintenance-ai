import Link from "next/link";
import type { CompanyThermalPriority } from "@prisma/client";
import { AlertTriangle, Crosshair, Flame, HelpCircle, Siren, WifiOff } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { thermalMonitoringService } from "@/features/thermal-monitoring/services/thermal-monitoring.service";
import { filterMonitoringPoints, inferenceAge, numeric, type MonitoringFilters } from "@/features/thermal-monitoring/services/thermal-presentation";
import { MonitoringFiltersForm } from "@/features/thermal-monitoring/components/monitoring-filters";
import { MonitoringQuickFilters, AppliedFilterChips } from "@/features/thermal-monitoring/components/monitoring-quick-filters";
import { ThermalPointCard } from "@/features/thermal-monitoring/components/thermal-point-card";
import { OperationalHealthPanel } from "@/features/thermal-monitoring/components/operational-health-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils/format";
import { ThermalSyncButton } from "@/features/ai-core/components/thermal-sync-button";
import { MonitoringAutoRefresh } from "@/features/thermal-monitoring/components/monitoring-auto-refresh";
import { COMPANY_PRIORITY_LABELS } from "@/features/thermal-priority/constants";
import { CompanyPriorityBadge } from "@/features/thermal-priority/components/company-priority-badge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ThermalMonitoringPage({ searchParams }: { searchParams: MonitoringFilters }) {
  const user = await requirePermission("thermal-point:view");
  const { points, summary, queue, queueMetrics, openIncidents, historicalDistribution, ai, now } = await thermalMonitoringService.dashboard();
  const aiFailedReadings = queue.find((q) => q.analysisStatus === "AI_FAILED")?._count._all ?? 0;
  const filtered = filterMonitoringPoints(points, searchParams);
  const unique = (items: { id: string; name: string }[]) => Array.from(new Map(items.map((i) => [i.id, i])).values());
  const sectors = unique(points.map((p) => p.component.panel.sector));
  const equipments = unique(points.flatMap((p) => (p.component.panel.equipment ? [p.component.panel.equipment] : [])));
  const panels = unique(points.map((p) => ({ id: p.component.panel.id, name: p.component.panel.tag })));
  const components = unique(points.map((p) => ({ id: p.component.id, name: p.component.tag })));
  const toLabelMap = (items: { id: string; name: string }[]) => Object.fromEntries(items.map((i) => [i.id, i.name]));

  const latestReadings = points.flatMap((p) => p.readings);
  const hottest = [...latestReadings].sort((a, b) => b.temperatureMaxC - a.temperatureMaxC)[0];
  const delta = [...latestReadings].filter((r) => r.deltaTC !== null).sort((a, b) => b.deltaTC! - a.deltaTC!)[0];
  const lastReading = [...latestReadings].sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime())[0];
  const predictions = points.flatMap((p) => (p.prediction ? [p.prediction] : []));
  const lastPrediction = [...predictions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const fastest = points.filter((p) => p.currentRisk && p.prediction?.trendCPerHour != null).sort((a, b) => b.prediction!.trendCPerHour! - a.prediction!.trendCPerHour!)[0];

  const historicalTotal = Object.values(historicalDistribution).reduce((total, count) => total + count, 0);
  const historicalPriorities = (Object.keys(COMPANY_PRIORITY_LABELS) as CompanyThermalPriority[]).filter(
    (priority) => historicalDistribution[priority] > 0
  );

  const situationCards = [
    { label: "Pontos críticos", value: ai.status === "READY" ? summary.counts.CRITICAL : "Indisponível", icon: Flame, tone: "text-status-critical", href: "/thermal-monitoring?risk=CRITICAL" },
    { label: "Risco alto", value: ai.status === "READY" ? summary.counts.HIGH : "Indisponível", icon: AlertTriangle, tone: "text-status-high", href: "/thermal-monitoring?risk=HIGH" },
    { label: "Sem comunicação", value: summary.offline, icon: WifiOff, tone: "text-status-attention", href: "/thermal-monitoring?connectivity=OFFLINE" },
    { label: "Sem análise atual", value: summary.unclassified, icon: HelpCircle, tone: "text-muted-foreground", href: "/thermal-monitoring?risk=PENDING_AI" },
    { label: "Incidentes abertos", value: openIncidents, icon: Siren, tone: "text-status-high", href: "/thermal-incidents" },
  ] as const;

  const hasSyntheticData = latestReadings.some((r) => r.source === "SIMULATOR");

  return <div className="space-y-6">
    <MonitoringAutoRefresh />

    {/* Camada 1 — Contexto da página */}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">Monitoramento térmico preditivo</h1>
        <p className="mt-1 text-sm text-muted-foreground">Da medição contínua à evidência rastreável e à decisão humana.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={ai.status === "READY" ? "neutral" : "attention"}>{ai.status === "READY" ? "IA pronta" : "IA indisponível"}</Badge>
          <span>Última leitura: {formatDateTime(lastReading?.measuredAt)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {can(user.role, "thermal-reading:simulate") && <ThermalSyncButton />}
        <Button asChild variant="outline"><Link href="/thermal-incidents">Ver incidentes</Link></Button>
        {can(user.role, "thermal-reading:create") && <Button asChild><Link href="/thermal-readings/new">Registrar leitura</Link></Button>}
      </div>
    </div>

    {/* Camada 2 — Situação operacional (alto peso visual, primeira dobra) */}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      {situationCards.map((c) => (
        <Link key={c.label} href={c.href} className="rounded-lg border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <c.icon className={`h-5 w-5 ${c.tone}`} aria-hidden="true" />
          <p className={`mt-2 text-2xl font-semibold ${c.tone}`}>{c.value}</p>
          <p className="text-xs text-muted-foreground">{c.label}</p>
        </Link>
      ))}
    </div>

    {/* Camada 3 — Saúde da operação */}
    <div className="grid gap-3 text-sm sm:grid-cols-3">
      <Card><CardHeader><CardTitle>Maior temperatura / ΔT</CardTitle></CardHeader><CardContent>{numeric(hottest?.temperatureMaxC, " °C")} / {numeric(delta?.deltaTC, " °C")}<p className="mt-1 text-xs text-muted-foreground">Máximas entre as últimas leituras dos pontos; não classificam risco.</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Tendência mais rápida</CardTitle></CardHeader><CardContent>{numeric(fastest?.prediction?.trendCPerHour, " °C/h")} {fastest && <Link className="text-primary underline" href={`/thermal-monitoring/points/${fastest.id}`}>{fastest.code}</Link>}<p className="mt-1 text-xs text-muted-foreground">Feature registrada na inferência atual válida.</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Última inferência válida</CardTitle></CardHeader><CardContent>{formatDateTime(lastPrediction?.createdAt)}<p className="mt-1 text-xs text-muted-foreground">Idade: {inferenceAge(lastPrediction?.createdAt, now)}</p></CardContent></Card>
    </div>
    <OperationalHealthPanel
      queueMetrics={queueMetrics}
      aiStatus={ai.status}
      riskCounts={summary.counts}
      totalPoints={summary.total}
      connectivityPoints={points}
      aiFailedReadings={aiFailedReadings}
      now={now}
    />

    {hasSyntheticData && <p className="rounded-md border p-3 text-sm"><strong>Dados sintéticos:</strong> as leituras identificadas como SIMULATOR são simulações persistidas no banco.</p>}
    <Card>
      <CardHeader><CardTitle>Histórico de inspeções · {historicalTotal} achado{historicalTotal === 1 ? "" : "s"} registrado{historicalTotal === 1 ? "" : "s"}</CardTitle></CardHeader>
      <CardContent>
        {historicalTotal > 0 ? (
          <div className="flex flex-wrap gap-3">
            {historicalPriorities.map((priority) => (
              <div key={priority} className="flex items-center gap-1.5">
                <CompanyPriorityBadge priority={priority} />
                <span className="text-xs text-muted-foreground">× {historicalDistribution[priority]}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma inspeção histórica registrada ainda.</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Classificação registrada em inspeção; não é o risco atual calculado pela IA.</p>
      </CardContent>
    </Card>

    {/* Camada 4 — Pontos monitorados */}
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Pontos monitorados</h2>
      <MonitoringQuickFilters filters={searchParams} />
      <MonitoringFiltersForm filters={searchParams} options={{ sectors, equipments, panels, components }} />
      <AppliedFilterChips filters={searchParams} labels={{ sectors: toLabelMap(sectors), equipments: toLabelMap(equipments), panels: toLabelMap(panels), components: toLabelMap(components) }} />
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <p>{filtered.length} de {points.length} pontos</p>
        <p className="text-muted-foreground">Achados históricos: {points.filter((p) => p.historicalPriority).length} pontos com evidência de inspeção. Esse fato não indica o risco atual.</p>
      </div>
      {!filtered.length && (
        <EmptyState
          icon={Crosshair}
          title={points.length ? "Nenhum ponto corresponde aos filtros" : "Nenhum ponto ativo cadastrado"}
          description={points.length ? "Ajuste ou limpe os filtros aplicados para ver os pontos monitorados." : "Cadastre pontos termográficos para iniciar o monitoramento contínuo."}
          action={points.length ? <Button variant="outline" asChild><Link href="/thermal-monitoring">Limpar filtros</Link></Button> : undefined}
        />
      )}
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((point) => <ThermalPointCard key={point.id} point={point} now={now} />)}
      </div>
    </div>
  </div>;
}
