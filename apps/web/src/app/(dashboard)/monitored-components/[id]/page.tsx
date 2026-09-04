import Link from "next/link";
import { notFound } from "next/navigation";
import { monitoredComponentService } from "@/features/monitored-components/services/monitored-component.service";
import { toggleActiveMonitoredComponentAction } from "@/features/monitored-components/actions/toggle-active-monitored-component.action";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function MonitoredComponentDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePermission("panel:view");
  const component = await monitoredComponentService.getOrThrow(params.id).catch(() => null);
  if (!component) notFound();

  const canManage = can(user.role, "panel:manage");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Componentes Monitorados", href: "/monitored-components" },
              { label: component.tag },
            ]}
          />
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              {component.tag} — {component.name}
            </h1>
            <Badge variant={component.active ? "neutral" : "muted"}>{component.active ? "Ativo" : "Inativo"}</Badge>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/monitored-components/${component.id}/edit`}>Editar</Link>
            </Button>
            <form action={toggleActiveMonitoredComponentAction}>
              <input type="hidden" name="componentId" value={component.id} />
              <input type="hidden" name="nextActive" value={(!component.active).toString()} />
              <Button type="submit" variant={component.active ? "destructive" : "outline"}>
                {component.active ? "Inativar" : "Reativar"}
              </Button>
            </form>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Painel</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link href={`/electrical-panels/${component.panel.id}`} className="text-primary hover:underline">
              {component.panel.tag}
            </Link>{" "}
            — {component.panel.sector.name}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tipo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{component.componentType}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fase</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{component.phase ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Corrente nominal</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{component.ratedCurrent ? `${component.ratedCurrent} A` : "—"}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pontos termográficos</CardTitle>
          {canManage && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/thermal-points/new?componentId=${component.id}`}>Novo ponto</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {component.thermalPoints.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Nenhum ponto termográfico cadastrado neste componente.
                  </TableCell>
                </TableRow>
              )}
              {component.thermalPoints.map((point) => (
                <TableRow key={point.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/thermal-points/${point.id}`} className="text-primary hover:underline">
                      {point.code}
                    </Link>
                  </TableCell>
                  <TableCell>{point.name}</TableCell>
                  <TableCell>{point.monitoringMode}</TableCell>
                  <TableCell>
                    <Badge variant={point.active ? "neutral" : "muted"}>{point.active ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
