import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { thermalMonitoringRepository } from "@/features/thermal-monitoring/repositories/thermal-monitoring.repository";
import { getThermalAiState } from "@/features/thermal-monitoring/services/thermal-monitoring.service";
import { CONNECTIVITY_LABELS, currentPointRisk, inferenceAge, isTraceablePrediction, numeric, pointConnectivity } from "@/features/thermal-monitoring/services/thermal-presentation";
import { thermalSettingsService } from "@/features/thermal-settings/services/thermal-settings.service";
import { ThermalRiskBadge } from "@/features/thermal-monitoring/components/thermal-status";
import { PredictionEvidence } from "@/features/thermal-monitoring/components/prediction-evidence";
import { ThermalHistoryChart } from "@/features/thermal-monitoring/components/thermal-history-chart";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils/format";
import { COMPANY_PRIORITY_LABELS } from "@/features/thermal-priority/constants";

export const dynamic = "force-dynamic";

export default async function ThermalPointMonitoringPage({ params }: { params: { id: string } }) {
  const user = await requirePermission("thermal-point:view");
  const [point, ai] = await Promise.all([thermalMonitoringRepository.point(params.id), getThermalAiState()]);
  if (!point) notFound();
  const config = await thermalSettingsService.resolveForPoint(point.id);
  const reading = point.readings[0];
  const predictions = point.predictions.filter(isTraceablePrediction);
  const latest = predictions[0];
  const risk = currentPointRisk(reading, latest, ai.status);
  const panel = point.component.panel;
  const historicalFinding = point.inspectionFindings[0];
  const latestIncident = point.incidents[0];
  return <div className="space-y-6">
    <Breadcrumbs items={[{ label: "Monitoramento térmico", href: "/thermal-monitoring" }, { label: point.code }]} />
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">{point.code} · {point.name}</h1><p className="mt-1 text-sm text-muted-foreground">{panel.sector.name} / {panel.equipment?.tag ?? "Painel setorial"} / <Link className="underline" href={`/electrical-panels/${panel.id}`}>{panel.tag}</Link> / {point.component.tag}</p></div>
      <div className="flex flex-wrap gap-2"><ThermalRiskBadge risk={risk} />{can(user.role, "thermal-reading:create") && <Button asChild size="sm"><Link href={`/thermal-readings/new?thermalPointId=${point.id}`}>Registrar leitura</Link></Button>}<Button asChild size="sm" variant="outline"><Link href={`/thermal-points/${point.id}`}>Cadastro e configuração</Link></Button></div>
    </div>
    <div className="flex flex-wrap gap-2"><Badge>{reading?.analysisStatus ?? "Sem leitura"}</Badge><Badge>{CONNECTIVITY_LABELS[pointConnectivity(point, new Date())]}</Badge>{!point.active && <Badge>Ponto inativo</Badge>}{historicalFinding && <Badge>Histórico: {historicalFinding.sourcePriorityLabel}/{historicalFinding.companyPriority} — não é diagnóstico atual</Badge>}</div>
    {point.readings.some((r) => r.source === "SIMULATOR") && <p className="rounded-md border p-3 text-sm"><strong>Dados sintéticos:</strong> esta série contém leituras de simulação persistidas.</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
      ["Última temperatura", numeric(reading?.temperatureMaxC, " °C")], ["Referência / ΔT", `${numeric(reading?.referenceTemperatureC, " °C")} / ${numeric(reading?.deltaTC, " °C")}`],
      ["Tendência / persistência atuais", risk ? `${numeric(latest?.trendCPerHour, " °C/h")} / ${numeric(latest?.timeAboveLimitMin, " min")}` : "Aguardando análise válida"],
      ["Última leitura", formatDateTime(reading?.measuredAt)],
    ].map(([label, value]) => <Card key={label}><CardHeader><CardTitle>{label}</CardTitle></CardHeader><CardContent>{value}</CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Prioridades separadas</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-3"><div><strong>Classificação registrada</strong><p>{historicalFinding ? `${historicalFinding.sourcePriorityLabel} · ${COMPANY_PRIORITY_LABELS[historicalFinding.companyPriority]}` : "Sem achado histórico"}</p></div><div><strong>Risco atual da IA</strong><p>{risk ?? "Sem análise atual válida"}</p></div><div><strong>Decisão humana final</strong><p>{latestIncident?.finalCompanyPriority ? COMPANY_PRIORITY_LABELS[latestIncident.finalCompanyPriority] : "Ainda não confirmada"}</p></div>{historicalFinding && <p className="sm:col-span-3 text-muted-foreground">Inspeção registrada em {formatDateTime(historicalFinding.inspection.inspectedAt)}{historicalFinding.inspection.technicianName ? ` · ${historicalFinding.inspection.technicianName}` : ""} · Temperatura/referência/ΔT: {numeric(historicalFinding.temperatureMaxC, " °C")} / {numeric(historicalFinding.referenceTemperatureC, " °C")} / {numeric(historicalFinding.deltaTC, " °C")} · {historicalFinding.recommendation}</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Série térmica, corrente e carga</CardTitle><p className="text-xs text-muted-foreground">{point.readings.length} últimas leituras de {point._count.readings}. Intervalo: {formatDateTime(point.readings[point.readings.length - 1]?.measuredAt)} a {formatDateTime(reading?.measuredAt)}.</p></CardHeader><CardContent>
      <ThermalHistoryChart readings={[...point.readings].reverse().map((r) => ({ id: r.id, timestamp: r.measuredAt.getTime(), temperatureMaxC: r.temperatureMaxC, referenceTemperatureC: r.referenceTemperatureC, deltaTC: r.deltaTC, currentA: r.currentA, loadPercent: r.loadPercent }))} absoluteLimitC={config.values.absoluteLimitC} />
      <details className="mt-4"><summary className="cursor-pointer text-sm font-medium">Consultar valores e IDs das leituras</summary><Table><TableHeader><TableRow>{["Data / ID", "Origem / análise", "Temperatura", "Referência", "ΔT", "Corrente", "Carga"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{point.readings.map((r) => <TableRow key={r.id}><TableCell>{formatDateTime(r.measuredAt)}<small className="block font-mono">{r.id}</small></TableCell><TableCell>{r.source === "SIMULATOR" ? "Dados sintéticos" : r.source}<small className="block">{r.analysisStatus}</small></TableCell><TableCell>{numeric(r.temperatureMaxC, " °C")}</TableCell><TableCell>{numeric(r.referenceTemperatureC, " °C")}</TableCell><TableCell>{numeric(r.deltaTC, " °C")}</TableCell><TableCell>{numeric(r.currentA, " A")}</TableCell><TableCell>{numeric(r.loadPercent, "%")}</TableCell></TableRow>)}</TableBody></Table></details>
    </CardContent></Card>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Histórico de predições</h2><p className="text-sm text-muted-foreground">Idade da última inferência: {inferenceAge(latest?.createdAt, new Date())}. Evidências abaixo descrevem suas leituras de origem; não substituem a análise de uma leitura nova.</p>
      {!predictions.length && <p className="rounded-lg border border-dashed p-6">Nenhuma Prediction térmica válida. Aguardando inferência do modelo real.</p>}
      {predictions.map((prediction, index) => <details key={prediction.id} open={index === 0}><summary className="mb-2 cursor-pointer text-sm">{formatDateTime(prediction.createdAt)} · {prediction.modelVersion}</summary><PredictionEvidence prediction={prediction} /></details>)}
    </section>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Incidentes registrados</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{!point.incidents.length && <p>Nenhum incidente originado pela IA.</p>}{point.incidents.map((i) => <Link className="block text-primary underline" key={i.id} href={`/thermal-incidents/${i.id}`}>{formatDateTime(i.openedAt)} · {i.severity} · {i.status}</Link>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Ordens de serviço vinculadas</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{!point.workOrders.length && <p>Nenhuma OS vinculada ao ponto.</p>}{point.workOrders.map((wo) => <Link className="block text-primary underline" key={wo.id} href={`/work-orders/${wo.id}`}>{wo.number} · {wo.status} · {wo.title}</Link>)}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>Configuração e calibração</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Modo: {point.monitoringMode} · Amostragem: {point.sampleIntervalSec} s · Emissividade: {numeric(point.emissivity)}</p><p>Referência: {point.referenceDescription ?? "Não cadastrada"}</p><p>Limite absoluto: {numeric(config.values.absoluteLimitC, " °C")} ({config.sources.absoluteLimitC}). Limites de ΔT: {numeric(config.values.deltaTAttentionC)} / {numeric(config.values.deltaTHighC)} / {numeric(config.values.deltaTCriticalC)} °C.</p><p className="text-muted-foreground">Parâmetros de engenharia resolvidos por ponto, tipo de componente, global ou padrão {config.defaultVersion}; não classificam risco na interface.</p>
      {!point.devices.length && <p>Nenhum dispositivo vinculado.</p>}{point.devices.map((d) => <div key={d.id} className="rounded-md border p-3"><Link className="font-medium text-primary underline" href={`/sensor-devices/${d.id}`}>{d.name} · {d.serialNumber}</Link><p>{d.status} · Último contato: {formatDateTime(d.lastSeenAt)} · Calibração: {formatDateTime(d.calibrationDate)} · Firmware: {d.firmwareVersion ?? "—"}</p></div>)}
    </CardContent></Card>
  </div>;
}
