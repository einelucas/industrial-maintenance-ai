import { workOrderScheduleRepository } from "@/features/work-orders/repositories/work-order-schedule.repository";
import { isWorkOrderDelayed } from "@/features/work-orders/services/work-order-delay.service";
import { sectorService } from "@/features/sectors/services/sector.service";
import { prisma } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { WorkOrderStatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils/format";
import { differenceInCalendarDays } from "date-fns";
import type { WorkOrderStatus, WorkOrderType } from "@prisma/client";

const STATUS_OPTIONS: WorkOrderStatus[] = ["OPEN", "PLANNED", "IN_PROGRESS", "WAITING_MATERIAL", "PAUSED", "COMPLETED", "CANCELED"];
const TYPE_OPTIONS: WorkOrderType[] = ["CORRECTIVE", "PREVENTIVE", "PREDICTIVE", "INSPECTION", "IMPROVEMENT"];

// Cronograma somente-leitura (seção 27), com filtros de período, setor,
// responsável, status e tipo aplicados via query string (GET nativo do
// navegador — sem necessidade de client component/JS extra).
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: { sectorId?: string; assignedUserId?: string; status?: string; type?: string; from?: string; to?: string };
}) {
  const [sectors, technicians] = await Promise.all([
    sectorService.list(),
    prisma.user.findMany({ where: { role: { in: ["TECHNICIAN", "PLANNER"] }, active: true }, orderBy: { name: "asc" } }),
  ]);

  const workOrders = await workOrderScheduleRepository.findFiltered({
    sectorId: searchParams.sectorId || undefined,
    assignedUserId: searchParams.assignedUserId || undefined,
    status: (searchParams.status as WorkOrderStatus) || undefined,
    type: (searchParams.type as WorkOrderType) || undefined,
    from: searchParams.from ? new Date(searchParams.from) : undefined,
    to: searchParams.to ? new Date(searchParams.to) : undefined,
  });

  const filterInputClass =
    "h-9 rounded-md border border-border bg-card px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Cronograma" }]} />
        <h1 className="text-xl font-semibold">Cronograma (somente leitura)</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3" method="GET">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">De</label>
              <input type="date" name="from" defaultValue={searchParams.from} className={filterInputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Até</label>
              <input type="date" name="to" defaultValue={searchParams.to} className={filterInputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Setor</label>
              <select name="sectorId" defaultValue={searchParams.sectorId ?? ""} className={filterInputClass}>
                <option value="">Todos</option>
                {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Responsável</label>
              <select name="assignedUserId" defaultValue={searchParams.assignedUserId ?? ""} className={filterInputClass}>
                <option value="">Todos</option>
                {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <select name="status" defaultValue={searchParams.status ?? ""} className={filterInputClass}>
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <select name="type" defaultValue={searchParams.type ?? ""} className={filterInputClass}>
                <option value="">Todos</option>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
              Filtrar
            </button>
            <a href="/schedule" className="h-9 rounded-md border border-border px-4 text-sm leading-9 hover:bg-muted">
              Limpar
            </a>
          </form>
        </CardContent>
      </Card>

      {workOrders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma OS com datas planejadas para os filtros selecionados.</p>
      ) : (
        <GanttChart workOrders={workOrders} />
      )}
    </div>
  );
}

function GanttChart({
  workOrders,
}: {
  workOrders: Awaited<ReturnType<typeof workOrderScheduleRepository.findFiltered>>;
}) {
  const starts = workOrders.map((wo) => wo.scheduledStart!.getTime());
  const ends = workOrders.map((wo) => wo.scheduledEnd!.getTime());
  const rangeStart = new Date(Math.min(...starts));
  const rangeEnd = new Date(Math.max(...ends));
  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart) + 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Ordens de Serviço planejadas — {formatDate(rangeStart)} a {formatDate(rangeEnd)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {workOrders.map((wo) => {
          const offsetDays = differenceInCalendarDays(wo.scheduledStart!, rangeStart);
          const durationDays = Math.max(1, differenceInCalendarDays(wo.scheduledEnd!, wo.scheduledStart!) + 1);
          const leftPct = (offsetDays / totalDays) * 100;
          const widthPct = (durationDays / totalDays) * 100;
          const delayed = isWorkOrderDelayed(wo.scheduledEnd, wo.status);

          return (
            <div key={wo.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  {wo.number} — {wo.equipment.tag} · {wo.equipment.sector.name} · {wo.assignedUser?.name ?? "Não atribuído"}
                </span>
                <WorkOrderStatusBadge status={wo.status} />
              </div>
              <div className="relative h-6 w-full rounded bg-muted">
                <div
                  className={`absolute h-6 rounded ${delayed ? "bg-status-critical" : "bg-primary"}`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`${formatDate(wo.scheduledStart)} — ${formatDate(wo.scheduledEnd)}`}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
