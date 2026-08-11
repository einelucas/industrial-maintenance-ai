import { notFound } from "next/navigation";
import { workOrderService } from "@/features/work-orders/services/work-order.service";
import { VALID_TRANSITIONS } from "@/features/work-orders/schemas/work-order.schema";
import { isWorkOrderDelayed } from "@/features/work-orders/services/work-order-delay.service";
import { StatusTransitionForm } from "@/features/work-orders/components/status-transition-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { WorkOrderStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Abrir",
  PLANNED: "Planejar",
  IN_PROGRESS: "Iniciar",
  WAITING_MATERIAL: "Aguardar material",
  PAUSED: "Pausar",
  COMPLETED: "Concluir",
  CANCELED: "Cancelar",
};

export default async function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const workOrder = await workOrderService.getOrThrow(params.id).catch(() => null);
  if (!workOrder) notFound();

  const delayed = isWorkOrderDelayed(workOrder.scheduledEnd, workOrder.status);
  const nextOptions = (VALID_TRANSITIONS[workOrder.status] ?? []).map((status) => ({
    value: status,
    label: STATUS_LABEL[status] ?? status,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Ordens de Serviço", href: "/work-orders" },
            { label: workOrder.number },
          ]}
        />
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{workOrder.number} — {workOrder.title}</h1>
          <WorkOrderStatusBadge status={workOrder.status} />
          <PriorityBadge priority={workOrder.priority} />
          {delayed && <Badge variant="critical">Atrasada</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Equipamento</div>
              <div>{workOrder.equipment.tag} — {workOrder.equipment.name}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Tipo</div>
              <div>{workOrder.type}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Responsável</div>
              <div>{workOrder.assignedUser?.name ?? "Não atribuído"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Criada por</div>
              <div>{workOrder.createdBy.name}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Início planejado</div>
              <div>{formatDateTime(workOrder.scheduledStart)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Fim planejado</div>
              <div>{formatDateTime(workOrder.scheduledEnd)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Início real</div>
              <div>{formatDateTime(workOrder.actualStart)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Fim real</div>
              <div>{formatDateTime(workOrder.actualEnd)}</div>
            </div>
            {workOrder.description && (
              <div className="col-span-2">
                <div className="text-muted-foreground">Descrição</div>
                <div>{workOrder.description}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTransitionForm workOrderId={workOrder.id} options={nextOptions} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workOrder.history.length === 0 && <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>}
          {workOrder.history.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between border-b border-border pb-2 text-sm last:border-0">
              <div>
                <div className="font-medium">{entry.action}</div>
                <div className="text-muted-foreground">
                  {entry.previousStatus ?? "—"} → {entry.newStatus ?? "—"} {entry.description ? `· ${entry.description}` : ""}
                </div>
              </div>
              <div className="whitespace-nowrap text-xs text-muted-foreground">
                {formatDateTime(entry.createdAt)} · {entry.user.name}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
