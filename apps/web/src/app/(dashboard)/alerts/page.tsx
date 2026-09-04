import Link from "next/link";
import type { AlertSeverity, AlertStatus } from "@prisma/client";
import { alertService } from "@/features/alerts/services/alert.service";
import { acknowledgeAlertAction, convertAlertToWorkOrderAction } from "@/features/alerts/actions/alert-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { AlertSeverityBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";
import { DEFAULT_PAGE_SIZE, parsePage, totalPages } from "@/lib/pagination";

const STATUS_OPTIONS: AlertStatus[] = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"];
const SEVERITY_OPTIONS: AlertSeverity[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

type SearchParams = { status?: string; severity?: string; page?: string };

export default async function AlertsPage({ searchParams }: { searchParams: SearchParams }) {
  const page = parsePage(searchParams.page);

  const { items: alerts, total } = await alertService.listFiltered({
    status: (searchParams.status as AlertStatus) || undefined,
    severity: (searchParams.severity as AlertSeverity) || undefined,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Alertas" }]} />
        <h1 className="text-xl font-semibold">Alertas Preditivos</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={searchParams.status ?? ""} className="w-44">
                <option value="">Abertos/Reconhecidos</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="severity">Severidade</Label>
              <Select id="severity" name="severity" defaultValue={searchParams.severity ?? ""} className="w-40">
                <option value="">Todas</option>
                {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/alerts">Limpar</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipamento</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum alerta encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    {alert.equipment ? (
                      <>
                        <Link href={`/equipments/${alert.equipmentId}`} className="text-primary hover:underline">
                          {alert.equipment.tag}
                        </Link>
                        <div className="text-xs text-muted-foreground">{alert.equipment.sector.name}</div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>{alert.title}</div>
                    <div className="text-xs text-muted-foreground">{alert.description}</div>
                  </TableCell>
                  <TableCell>
                    <AlertSeverityBadge severity={alert.severity} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={alert.status === "OPEN" ? "attention" : "muted"}>
                      {alert.status === "OPEN" ? "Aberto" : alert.status === "ACKNOWLEDGED" ? "Reconhecido" : alert.status === "RESOLVED" ? "Resolvido" : "Dispensado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{formatDateTime(alert.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {alert.status === "OPEN" && (
                        <form action={acknowledgeAlertAction}>
                          <input type="hidden" name="alertId" value={alert.id} />
                          <Button type="submit" size="sm" variant="outline">Reconhecer</Button>
                        </form>
                      )}
                      {(alert.status === "OPEN" || alert.status === "ACKNOWLEDGED") && (
                        <form action={convertAlertToWorkOrderAction}>
                          <input type="hidden" name="alertId" value={alert.id} />
                          <Button type="submit" size="sm">Criar OS preditiva</Button>
                        </form>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages(total)} basePath="/alerts" searchParams={searchParams} />
        </CardContent>
      </Card>
    </div>
  );
}
