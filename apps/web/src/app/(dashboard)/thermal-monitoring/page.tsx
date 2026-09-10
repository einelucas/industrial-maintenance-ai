import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { thermalMonitoringService } from "@/features/thermal-monitoring/services/thermal-monitoring.service";
import { CONNECTIVITY_LABELS, RISK_LABELS, filterMonitoringPoints, inferenceAge, numeric, type MonitoringFilters } from "@/features/thermal-monitoring/services/thermal-presentation";
import { MonitoringFiltersForm } from "@/features/thermal-monitoring/components/monitoring-filters";
import { ThermalRiskBadge } from "@/features/thermal-monitoring/components/thermal-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/format";
import { ThermalSyncButton } from "@/features/ai-core/components/thermal-sync-button";
import { COMPANY_PRIORITY_LABELS } from "@/features/thermal-priority/constants";
import { MonitoringAutoRefresh } from "@/features/thermal-monitoring/components/monitoring-auto-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ThermalMonitoringPage({ searchParams }: { searchParams: MonitoringFilters }) {
  const user = await requirePermission("thermal-point:view");
  const { points, summary, queue, queueMetrics, openIncidents, ai, now } = await thermalMonitoringService.dashboard();
  const filtered = filterMonitoringPoints(points, searchParams);
  const unique = (items: { id: string; name: string }[]) => Array.from(new Map(items.map((i) => [i.id, i])).values());
  const latestReadings = points.flatMap((p) => p.readings);
  const hottest = [...latestReadings].sort((a, b) => b.temperatureMaxC - a.temperatureMaxC)[0];
  const delta = [...latestReadings].filter((r) => r.deltaTC !== null).sort((a, b) => b.deltaTC! - a.deltaTC!)[0];
  const lastReading = [...latestReadings].sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime())[0];
  const predictions = points.flatMap((p) => p.prediction ? [p.prediction] : []);
  const historicalDistribution = Object.keys(COMPANY_PRIORITY_LABELS).map((priority) => ({
    priority,
    count: points.filter((point) => point.historicalPriority === priority).length,
  }));
  const lastPrediction = [...predictions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const fastest = points.filter((p) => p.currentRisk && p.prediction?.trendCPerHour != null).sort((a, b) => b.prediction!.trendCPerHour! - a.prediction!.trendCPerHour!)[0];
  const counters = [
    { label: "Total monitorado", value: String(summary.total) },
    ...Object.entries(RISK_LABELS).map(([risk, label]) => ({ label, value: ai.status === "READY" ? String(summary.counts[risk as keyof typeof summary.counts]) : "Indisponível" })),
    { label: "Sem análise atual", value: String(summary.unclassified) },
    { label: "Sem comunicação", value: String(summary.offline) },
    { label: "Incidentes abertos (registrados)", value: String(openIncidents) },
  ];
  return <div className="space-y-6">
    <MonitoringAutoRefresh />
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Monitoramento térmico</h1>
      <p className="mt-1 text-sm text-muted-foreground">Da medição à evidência da IA e à decisão humana.</p></div>
      <div className="flex flex-wrap items-start gap-2">
        {can(user.role, "thermal-reading:simulate") && <ThermalSyncButton />}
        <Button asChild variant="outline"><Link href="/thermal-incidents">Ver incidentes</Link></Button>
        {can(user.role, "thermal-reading:create") && <Button asChild><Link href="/thermal-readings/new">Registrar leitura</Link></Button>}
      </div></div>
    {latestReadings.some((r) => r.source === "SIMULATOR") && <p className="rounded-md border p-3 text-sm"><strong>Dados sintéticos:</strong> as leituras identificadas como SIMULATOR são simulações persistidas no banco.</p>}
    <Card><CardHeader><CardTitle>Inspeção original · classificação empresarial</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{historicalDistribution.map(({ priority, count }) => <Badge key={priority}>{COMPANY_PRIORITY_LABELS[priority as keyof typeof COMPANY_PRIORITY_LABELS]}: {count}</Badge>)}</div><p className="mt-2 text-xs text-muted-foreground">Rótulos históricos da inspeção, separados do risco atual calculado pela IA. P30/P50/P100 aguardam definição oficial.</p></CardContent></Card>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{counters.map((c) => <Card key={c.label}><CardHeader className="pb-2"><CardTitle>{c.label}</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{c.value}</CardContent></Card>)}</div>
    <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
      <Card><CardHeader><CardTitle>Maior temperatura / ΔT</CardTitle></CardHeader><CardContent>{numeric(hottest?.temperatureMaxC, " °C")} / {numeric(delta?.deltaTC, " °C")}<p className="mt-1 text-xs text-muted-foreground">Máximas entre as últimas leituras dos pontos; não classificam risco.</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Tendência mais rápida</CardTitle></CardHeader><CardContent>{numeric(fastest?.prediction?.trendCPerHour, " °C/h")} {fastest && <Link className="text-primary underline" href={`/thermal-monitoring/points/${fastest.id}`}>{fastest.code}</Link>}<p className="mt-1 text-xs text-muted-foreground">Feature registrada na inferência atual válida.</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Última atualização</CardTitle></CardHeader><CardContent>{formatDateTime(lastReading?.measuredAt)}<p className="mt-1 text-xs text-muted-foreground">Inferência: {formatDateTime(lastPrediction?.createdAt)} · idade: {inferenceAge(lastPrediction?.createdAt, now)}</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Fila de análise</CardTitle></CardHeader><CardContent><p>Históricas aguardando: {queueMetrics.orphanedReadings}</p><p>Enfileiradas: {queueMetrics.pendingRequests}</p><p>Em processamento: {queueMetrics.leasedCount}</p><p>Não analisáveis/falhas isoladas: {queue.find((q) => q.analysisStatus === "AI_FAILED")?._count._all ?? 0}</p><p>Recebidas/persistidas/analisadas (1 h): {queueMetrics.receivedLastHour}/{queueMetrics.persistedLastHour}/{queueMetrics.analyzedLastHour}</p><p>Duplicadas/rejeitadas (1 h): {queueMetrics.duplicateLastHour}/{queueMetrics.rejectedLastHour}</p><p className="mt-1 text-xs text-muted-foreground">Mais antiga na fila real: {formatDateTime(queueMetrics.oldestPendingAt)} · Requisições encerradas: {queueMetrics.failedRequests}</p></CardContent></Card>
    </div>
    <MonitoringFiltersForm filters={searchParams} options={{
      sectors: unique(points.map((p) => p.component.panel.sector)), equipments: unique(points.flatMap((p) => p.component.panel.equipment ? [p.component.panel.equipment] : [])),
      panels: unique(points.map((p) => ({ id: p.component.panel.id, name: p.component.panel.tag }))),
      components: unique(points.map((p) => ({ id: p.component.id, name: p.component.tag }))),
    }} />
    <div className="flex flex-wrap justify-between gap-2 text-sm"><p>{filtered.length} de {points.length} pontos</p><p className="text-muted-foreground">Inspeção original: {points.filter((p) => p.historicalPriority).length} achados auditáveis. Esse fato não indica o risco atual.</p></div>
    {!filtered.length && <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">{points.length ? "Nenhum ponto corresponde aos filtros." : "Nenhum ponto ativo cadastrado."}</p>}
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{filtered.map((point) => {
      const reading = point.readings[0];
      return <Link key={point.id} href={`/thermal-monitoring/points/${point.id}`} className="min-w-0 rounded-lg border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-semibold">{point.code} · {point.name}</h2><ThermalRiskBadge risk={point.currentRisk} /></div>
        <p className="mt-2 text-xs text-muted-foreground">{point.component.panel.sector.name} / {point.component.panel.equipment?.tag ?? "Painel setorial"} / {point.component.panel.tag} / {point.component.tag}</p>
        <div className="my-3 flex flex-wrap gap-x-6 gap-y-1 text-sm"><span>Temperatura: <strong>{numeric(reading?.temperatureMaxC, " °C")}</strong></span><span>ΔT: <strong>{numeric(reading?.deltaTC, " °C")}</strong></span></div>
        <div className="flex flex-wrap gap-2"><Badge>{reading?.analysisStatus ?? "Sem leitura"}</Badge><Badge>{CONNECTIVITY_LABELS[point.connectivity]}</Badge>{reading?.source === "SIMULATOR" && <Badge>Dados sintéticos</Badge>}{point.historicalPriority && <Badge>Histórico: {COMPANY_PRIORITY_LABELS[point.historicalPriority]}</Badge>}</div>
        <p className="mt-3 text-xs text-muted-foreground">Leitura: {formatDateTime(reading?.measuredAt)} · Inferência: {inferenceAge(point.prediction?.createdAt, now)}</p>
      </Link>;
    })}</div>
  </div>;
}
