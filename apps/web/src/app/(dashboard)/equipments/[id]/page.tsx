import Link from "next/link";
import { notFound } from "next/navigation";
import { equipmentService } from "@/features/equipments/services/equipment.service";
import { workOrderRepository } from "@/features/work-orders/repositories/work-order.repository";
import { maintenancePlanRepository } from "@/features/maintenance-plans/repositories/maintenance-plan.repository";
import { FailureEventForm } from "@/features/failure-events/components/failure-event-form";
import { failureEventService } from "@/features/failure-events/services/failure-event.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  EquipmentStatusBadge,
  WorkOrderStatusBadge,
} from "@/components/shared/status-badge";
import { formatDate, formatDateTime } from "@/lib/utils/format";

export default async function EquipmentDetailPage({ params }: { params: { id: string } }) {
  const equipment = await equipmentService.getOrThrow(params.id).catch(() => null);
  if (!equipment) notFound();

  const [workOrders, plans, failureEvents] = await Promise.all([
    workOrderRepository.findByEquipment(equipment.id),
    maintenancePlanRepository.findByEquipment(equipment.id),
    failureEventService.listByEquipment(equipment.id),
  ]);

  const lastIntervention = workOrders.find((wo) => wo.status === "COMPLETED");
  const nextPreventive = plans.sort((a, b) => a.nextExecution.getTime() - b.nextExecution.getTime())[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Equipamentos", href: "/equipments" },
              { label: equipment.tag },
            ]}
          />
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{equipment.tag} — {equipment.name}</h1>
            <EquipmentStatusBadge status={equipment.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/equipments/${equipment.id}/edit`}>Editar</Link>
          </Button>
          <Button asChild>
            <Link href="/thermal-incidents">Revisar incidentes para OS</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="os">Ordens de Serviço</TabsTrigger>
          <TabsTrigger value="preventivas">Preventivas</TabsTrigger>
          <TabsTrigger value="falhas">Falhas reais</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Setor</CardTitle></CardHeader>
              <CardContent className="text-sm">{equipment.sector.name}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Criticidade</CardTitle></CardHeader>
              <CardContent className="text-sm">{equipment.criticality}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Categoria</CardTitle></CardHeader>
              <CardContent className="text-sm">{equipment.category}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Última intervenção</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {lastIntervention ? `${lastIntervention.number} — ${formatDate(lastIntervention.actualEnd)}` : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Próxima preventiva</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {nextPreventive ? `${nextPreventive.name} — ${formatDate(nextPreventive.nextExecution)}` : "Nenhum plano ativo"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Monitoramento térmico</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <Link className="text-primary underline" href={`/thermal-monitoring?equipmentId=${equipment.id}`}>Consultar pontos, leituras e evidências da IA</Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="os">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workOrders.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Nenhuma OS para este equipamento.</TableCell></TableRow>
              )}
              {workOrders.map((wo) => (
                <TableRow key={wo.id}>
                  <TableCell><Link href={`/work-orders/${wo.id}`} className="text-primary hover:underline">{wo.number}</Link></TableCell>
                  <TableCell>{wo.title}</TableCell>
                  <TableCell>{wo.type}</TableCell>
                  <TableCell><WorkOrderStatusBadge status={wo.status} /></TableCell>
                  <TableCell>{wo.assignedUser?.name ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="preventivas">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Próxima execução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 && (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Nenhum plano preventivo.</TableCell></TableRow>
              )}
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>{plan.name}</TableCell>
                  <TableCell>{plan.frequencyType}</TableCell>
                  <TableCell>{formatDate(plan.nextExecution)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="falhas">
          <div className="space-y-6">
            <FailureEventForm
              equipmentId={equipment.id}
              workOrders={workOrders.map((wo) => ({ id: wo.id, number: wo.number }))}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/hora</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>OS relacionada</TableHead>
                  <TableHead>Registrado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failureEvents.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Nenhuma falha real registrada.</TableCell></TableRow>
                )}
                {failureEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{formatDateTime(event.occurredAt)}</TableCell>
                    <TableCell>{event.description ?? "—"}</TableCell>
                    <TableCell>
                      {event.workOrder ? (
                        <Link href={`/work-orders/${event.workOrder.id}`} className="text-primary hover:underline">
                          {event.workOrder.number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{event.createdBy.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <p className="text-sm text-muted-foreground">
            O histórico completo de eventos está disponível em cada Ordem de Serviço individual (aba &ldquo;Ordens de Serviço&rdquo;).
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
