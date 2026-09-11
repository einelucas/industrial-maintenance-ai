import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import type { WorkOrderPriority, WorkOrderStatus, WorkOrderType } from "@prisma/client";
import { workOrderService } from "@/features/work-orders/services/work-order.service";
import { isWorkOrderDelayed } from "@/features/work-orders/services/work-order-delay.service";
import { WORK_ORDER_TYPE_LABELS } from "@/features/work-orders/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { WorkOrderStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";
import { DEFAULT_PAGE_SIZE, parsePage, totalPages } from "@/lib/pagination";

const STATUS_OPTIONS: WorkOrderStatus[] = ["OPEN", "PLANNED", "IN_PROGRESS", "WAITING_MATERIAL", "PAUSED", "COMPLETED", "CANCELED"];
const TYPE_OPTIONS: WorkOrderType[] = ["CORRECTIVE", "PREVENTIVE", "PREDICTIVE", "INSPECTION", "IMPROVEMENT"];
const PRIORITY_OPTIONS: WorkOrderPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

type SearchParams = { search?: string; status?: string; type?: string; priority?: string; page?: string };

export default async function WorkOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const page = parsePage(searchParams.page);

  const { items: workOrders, total } = await workOrderService.listFiltered({
    search: searchParams.search || undefined,
    status: (searchParams.status as WorkOrderStatus) || undefined,
    type: (searchParams.type as WorkOrderType) || undefined,
    priority: (searchParams.priority as WorkOrderPriority) || undefined,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs items={[{ label: "Monitoramento", href: "/thermal-monitoring" }, { label: "Ordens de Serviço" }]} />
          <h1 className="text-xl font-semibold">Ordens de Serviço</h1>
        </div>
        <Button asChild>
          <Link href="/thermal-incidents">
            <Plus className="h-4 w-4" /> Autorizar OS por incidente
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="search">Buscar</Label>
              <Input id="search" name="search" placeholder="Número ou título..." defaultValue={searchParams.search ?? ""} className="w-56" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={searchParams.status ?? ""} className="w-44">
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="type">Tipo</Label>
              <Select id="type" name="type" defaultValue={searchParams.type ?? ""} className="w-40">
                <option value="">Todos</option>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{WORK_ORDER_TYPE_LABELS[t]}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="priority">Prioridade</Label>
              <Select id="priority" name="priority" defaultValue={searchParams.priority ?? ""} className="w-36">
                <option value="">Todas</option>
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/work-orders">Limpar</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead className="hidden md:table-cell">Título</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="hidden sm:table-cell">Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Nenhuma ordem de serviço encontrada para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
                {workOrders.map((wo) => {
                  const delayed = isWorkOrderDelayed(wo.scheduledEnd, wo.status);
                  return (
                    <TableRow key={wo.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/work-orders/${wo.id}`} className="text-primary hover:underline">
                          {wo.number}
                        </Link>
                        <span className="mt-0.5 block max-w-[10rem] truncate text-xs font-normal text-muted-foreground md:hidden">{wo.title}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{wo.title}</TableCell>
                      <TableCell>{wo.equipment.tag}</TableCell>
                      <TableCell className="hidden sm:table-cell">{WORK_ORDER_TYPE_LABELS[wo.type]}</TableCell>
                      <TableCell>
                        <PriorityBadge priority={wo.priority} />
                      </TableCell>
                      <TableCell>
                        <WorkOrderStatusBadge status={wo.status} />
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-nowrap">{formatDate(wo.scheduledEnd)}</span>
                        {delayed && (
                          <Badge variant="critical" className="ml-1 gap-1">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Atrasada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{wo.assignedUser?.name ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} totalPages={totalPages(total)} basePath="/work-orders" searchParams={searchParams} />
        </CardContent>
      </Card>
    </div>
  );
}
