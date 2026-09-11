import Link from "next/link";
import { formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Inbox } from "lucide-react";
import type { IncidentStatus, Prisma, AlertSeverity } from "@prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { incidentViewRepository } from "@/features/thermal-incidents/repositories/incident-view.repository";
import { INCIDENT_STATUS_LABELS, incidentNextAction } from "@/features/thermal-incidents/services/incident-presentation";
import { isTraceablePrediction, numeric, RISK_LABELS } from "@/features/thermal-monitoring/services/thermal-presentation";
import { ThermalRiskBadge } from "@/features/thermal-monitoring/components/thermal-status";
import { FilterSelect } from "@/features/thermal-monitoring/components/monitoring-filters";
import { CompanyPriorityBadge } from "@/features/thermal-priority/components/company-priority-badge";
import { WorkOrderStatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ThermalIncidentsPage({ searchParams }: { searchParams: { search?: string; status?: string; severity?: string; page?: string } }) {
  await requirePermission("incident:view");
  const page = Math.max(1, Math.min(10000, Number.parseInt(searchParams.page ?? "1", 10) || 1));
  const where: Prisma.ThermalIncidentWhereInput = {};
  if (searchParams.status && Object.prototype.hasOwnProperty.call(INCIDENT_STATUS_LABELS, searchParams.status)) where.status = searchParams.status as IncidentStatus;
  if (searchParams.severity && Object.prototype.hasOwnProperty.call(RISK_LABELS, searchParams.severity)) where.severity = searchParams.severity as AlertSeverity;
  if (searchParams.search) where.thermalPoint = { OR: [{ code: { contains: searchParams.search, mode: "insensitive" } }, { name: { contains: searchParams.search, mode: "insensitive" } }] };
  const { items, total } = await incidentViewRepository.list(where, (page - 1) * 24, 24);
  const pageHref = (n: number) => `/thermal-incidents?${new URLSearchParams({ search: searchParams.search ?? "", status: searchParams.status ?? "", severity: searchParams.severity ?? "", page: String(n) })}`;
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Incidentes térmicos</h1><p className="mt-1 text-sm text-muted-foreground">Incidentes originados pela IA. Severidade e picos abaixo são evidências registradas, não uma nova avaliação.</p></div>
    <form className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4" action="/thermal-incidents"><div className="space-y-1"><Label htmlFor="search">Código ou nome do ponto</Label><Input name="search" id="search" defaultValue={searchParams.search} /></div><FilterSelect name="status" label="Estado do incidente" value={searchParams.status} options={Object.entries(INCIDENT_STATUS_LABELS).map(([id, name]) => ({ id, name }))} /><FilterSelect name="severity" label="Severidade registrada" value={searchParams.severity} options={Object.entries(RISK_LABELS).map(([id, name]) => ({ id, name }))} /><div className="flex items-end gap-2"><Button type="submit">Aplicar filtros</Button><Button variant="outline" asChild><Link href="/thermal-incidents">Limpar</Link></Button></div></form>
    <p className="text-sm text-muted-foreground">{total} incidentes encontrados.</p>
    {!items.length && (
      <EmptyState
        icon={Inbox}
        title="Nenhum incidente encontrado"
        description="Um incidente só pode surgir de uma inferência válida da IA. Leituras pendentes não significam ausência de risco."
        action={<Button variant="outline" asChild><Link href="/thermal-monitoring">Consultar pontos e leituras</Link></Button>}
      />
    )}
    <div className="grid gap-3 lg:grid-cols-2">{items.map((incident) => {
      const openDuration = formatDistanceStrict(incident.normalizedAt ?? new Date(), incident.openedAt, { locale: ptBR });
      const reviewDone = incident.humanReviewDecision !== null;
      const priority = incident.finalCompanyPriority ?? incident.recommendedCompanyPriority;
      return <Link key={incident.id} href={`/thermal-incidents/${incident.id}`} className="space-y-3 rounded-lg border bg-card p-4 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{incident.thermalPoint.code} · {incident.thermalPoint.name}</h2><ThermalRiskBadge risk={isTraceablePrediction(incident.triggerPrediction) ? incident.severity : null} /></div>
        <p className="text-sm">{INCIDENT_STATUS_LABELS[incident.status]}</p>
        <p className="text-xs text-muted-foreground">{incident.thermalPoint.component.panel.sector.name} / {incident.thermalPoint.component.panel.tag}</p>
        <p className="text-sm">Pico: {numeric(incident.peakTemperatureC, " °C")} · ΔT: {numeric(incident.peakDeltaTC, " °C")} · Aberto há: {openDuration}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant={reviewDone ? "neutral" : "attention"}>Revisão humana: {reviewDone ? "concluída" : "pendente"}</Badge>
          {priority && <CompanyPriorityBadge priority={priority} prefix={incident.finalCompanyPriority ? "Final" : "Recomendada"} />}
          {incident.workOrder ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80">
              OS {incident.workOrder.number}
              <WorkOrderStatusBadge status={incident.workOrder.status} />
            </span>
          ) : (
            <Badge variant="muted">Próxima ação: {incidentNextAction(incident.status, incident.workOrderId)}</Badge>
          )}
          {incident.triggerPrediction.thermalReading?.source === "SIMULATOR" && <Badge variant="muted">Dados sintéticos</Badge>}
        </div>
      </Link>;
    })}</div>
    <nav aria-label="Paginação dos incidentes" className="flex items-center gap-3">{page > 1 && <Button variant="outline" asChild><Link href={pageHref(page - 1)}>Anterior</Link></Button>}<span className="text-sm">Página {page} de {Math.max(1, Math.ceil(total / 24))}</span>{page * 24 < total && <Button variant="outline" asChild><Link href={pageHref(page + 1)}>Próxima</Link></Button>}</nav>
  </div>;
}
