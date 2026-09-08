import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { incidentViewRepository } from "@/features/thermal-incidents/repositories/incident-view.repository";
import { INCIDENT_STATUS_LABELS, workOrderBlockReason } from "@/features/thermal-incidents/services/incident-presentation";
import { HumanReviewForm, PredictiveWorkOrderForm } from "@/features/thermal-incidents/components/incident-decision-forms";
import { getThermalAiState } from "@/features/thermal-monitoring/services/thermal-monitoring.service";
import { isTraceablePrediction, numeric } from "@/features/thermal-monitoring/services/thermal-presentation";
import { PredictionEvidence } from "@/features/thermal-monitoring/components/prediction-evidence";
import { ThermalRiskBadge } from "@/features/thermal-monitoring/components/thermal-status";
import { ThermalHistoryChart } from "@/features/thermal-monitoring/components/thermal-history-chart";
import { thermalSettingsService } from "@/features/thermal-settings/services/thermal-settings.service";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ThermalIncidentDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePermission("incident:view");
  const [incident, ai] = await Promise.all([incidentViewRepository.detail(params.id), getThermalAiState()]);
  if (!incident) notFound();
  const [readings, config] = await Promise.all([
    incidentViewRepository.readingsSince(incident.thermalPointId, incident.triggerPrediction.thermalReading?.measuredAt ?? incident.openedAt),
    thermalSettingsService.resolveForPoint(incident.thermalPointId),
  ]);
  const originValid = isTraceablePrediction(incident.triggerPrediction);
  const latest = incident.thermalPoint.predictions.find(isTraceablePrediction);
  const reviewBlocked = !originValid || !latest ? "Evidência válida indisponível." : incident.workOrderId || ["NORMALIZED", "DISMISSED"].includes(incident.status) ? "Este ciclo já foi encaminhado para manutenção ou encerrado." : null;
  const orderBlocked = workOrderBlockReason({ aiStatus: ai.status, canConvert: can(user.role, "incident:convert-to-work-order"), status: incident.status, decision: incident.humanReviewDecision, workOrderId: incident.workOrderId, equipmentId: incident.thermalPoint.component.panel.equipmentId, validEvidence: originValid });
  const timeline = [
    { id: "origin", at: incident.openedAt, title: "Incidente aberto pela IA", description: `Prediction ${incident.triggerPredictionId} · Inferência ${incident.triggerPrediction.inferenceId ?? "não rastreável"}` },
    ...incident.humanReviews.map((r) => ({ id: r.id, at: r.createdAt, title: `${r.reviewedBy.name} · ${r.decision}`, description: `${r.justification ?? "Sem justificativa adicional"} · ${INCIDENT_STATUS_LABELS[r.previousStatus]} → ${INCIDENT_STATUS_LABELS[r.nextStatus]} · Prediction revisada: ${r.reviewedPredictionId}` })),
    ...(incident.workOrder?.history.map((h) => ({ id: h.id, at: h.createdAt, title: `${h.user.name} · OS ${h.action}`, description: h.description ?? h.newStatus ?? "Atualização da OS" })) ?? []),
    ...(incident.normalizedAt ? [{ id: "normalized", at: incident.normalizedAt, title: "Normalização registrada", description: "Data persistida do encerramento analítico." }] : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  return <div className="space-y-6"><Breadcrumbs items={[{ label: "Incidentes térmicos", href: "/thermal-incidents" }, { label: incident.thermalPoint.code }]} />
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Incidente · {incident.thermalPoint.code}</h1><p className="mt-1 text-sm">{INCIDENT_STATUS_LABELS[incident.status]}</p><Link className="mt-2 inline-block text-sm text-primary underline" href={`/thermal-monitoring/points/${incident.thermalPointId}`}>Abrir ponto e histórico completo</Link></div><ThermalRiskBadge risk={originValid ? incident.severity : null} /></div>
    <p className="break-all text-xs text-muted-foreground">Incidente {incident.id} · {incident.triggerCount} inferências consolidadas · Última atualização: {formatDateTime(incident.updatedAt)}</p>
    <div className="grid gap-3 sm:grid-cols-3">{[["Pico registrado", numeric(incident.peakTemperatureC, " °C")], ["Pico de ΔT", numeric(incident.peakDeltaTC, " °C")], ["Último score registrado", originValid ? numeric(incident.lastRiskScore) : "Indisponível"]].map(([title, value]) => <Card key={title}><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{value}</CardContent></Card>)}</div>
    <p className="text-sm text-muted-foreground">As evidências abaixo são históricas e correspondem às leituras identificadas. A revisão avalia a predição mais recente exibida.</p>
    {originValid ? <PredictionEvidence prediction={incident.triggerPrediction} title="Evidência que originou o incidente" /> : <p role="alert">A evidência de origem não possui proveniência térmica válida. Operações bloqueadas.</p>}
    {latest && latest.id !== incident.triggerPredictionId && <PredictionEvidence prediction={latest} title="Evidência mais recente para revisão" />}
    <div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle>Decisão humana sobre o defeito</CardTitle></CardHeader><CardContent>{can(user.role, "incident:diagnose") ? <HumanReviewForm incidentId={incident.id} predictionId={latest?.id ?? incident.triggerPredictionId} blockedReason={reviewBlocked} /> : <p className="text-sm">Seu perfil permite consultar as decisões registradas.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Autorizar manutenção preditiva</CardTitle></CardHeader><CardContent>{incident.workOrder ? <Link className="text-primary underline" href={`/work-orders/${incident.workOrder.id}`}>{incident.workOrder.number} · {incident.workOrder.status}</Link> : <PredictiveWorkOrderForm incidentId={incident.id} blockedReason={orderBlocked} />}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>Evolução e monitoramento pós-ação</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm">{incident.workOrder?.status === "COMPLETED" ? "OS concluída. Consulte as leituras posteriores; a conclusão da OS não comprova normalização térmica." : "Aguardando intervenção concluída para avaliar o período pós-ação."}</p>
      {readings.some((r) => r.source === "SIMULATOR") && <p className="text-sm font-medium">Dados sintéticos presentes nesta série.</p>}
      <p className="text-xs text-muted-foreground">Até 240 leituras a partir da medição que originou o incidente. A série não classifica normalização.</p>
      <ThermalHistoryChart absoluteLimitC={config.values.absoluteLimitC} readings={[...readings].reverse().map((r) => ({ id: r.id, time: formatDateTime(r.measuredAt), temperatureMaxC: r.temperatureMaxC, referenceTemperatureC: r.referenceTemperatureC, deltaTC: r.deltaTC, currentA: r.currentA, loadPercent: r.loadPercent }))} />
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Linha do tempo auditável</CardTitle></CardHeader><CardContent><ol className="space-y-4 border-l pl-4">{timeline.map((event) => <li key={event.id} className="space-y-1"><p className="text-xs text-muted-foreground">{formatDateTime(event.at)}</p><h3 className="text-sm font-semibold">{event.title}</h3><p className="break-words text-sm">{event.description}</p></li>)}</ol></CardContent></Card>
  </div>;
}
