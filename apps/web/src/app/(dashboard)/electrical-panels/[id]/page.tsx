import Link from "next/link";
import { notFound } from "next/navigation";
import { electricalPanelService } from "@/features/electrical-panels/services/electrical-panel.service";
import { toggleActiveElectricalPanelAction } from "@/features/electrical-panels/actions/toggle-active-electrical-panel.action";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function ElectricalPanelDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePermission("panel:view");
  const panel = await electricalPanelService.getOrThrow(params.id).catch(() => null);
  if (!panel) notFound();

  const canManage = can(user.role, "panel:manage");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Painéis Elétricos", href: "/electrical-panels" },
              { label: panel.tag },
            ]}
          />
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              {panel.tag} — {panel.name}
            </h1>
            <Badge variant={panel.active ? "neutral" : "muted"}>{panel.active ? "Ativo" : "Inativo"}</Badge>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/electrical-panels/${panel.id}/edit`}>Editar</Link>
            </Button>
            <form action={toggleActiveElectricalPanelAction}>
              <input type="hidden" name="panelId" value={panel.id} />
              <input type="hidden" name="nextActive" value={(!panel.active).toString()} />
              <Button type="submit" variant={panel.active ? "destructive" : "outline"}>
                {panel.active ? "Inativar" : "Reativar"}
              </Button>
            </form>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Setor</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{panel.sector.name}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Equipamento</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{panel.equipment ? `${panel.equipment.tag} — ${panel.equipment.name}` : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tipo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{panel.panelType}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Localização</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{panel.location ?? "—"}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Componentes monitorados</CardTitle>
          {canManage && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/monitored-components/new?panelId=${panel.id}`}>Novo componente</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TAG</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Pontos</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {panel.components.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Nenhum componente cadastrado neste painel.
                  </TableCell>
                </TableRow>
              )}
              {panel.components.map((component) => (
                <TableRow key={component.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/monitored-components/${component.id}`} className="text-primary hover:underline">
                      {component.tag}
                    </Link>
                  </TableCell>
                  <TableCell>{component.name}</TableCell>
                  <TableCell>{component.componentType}</TableCell>
                  <TableCell>{component._count.thermalPoints}</TableCell>
                  <TableCell>
                    <Badge variant={component.active ? "neutral" : "muted"}>{component.active ? "Ativo" : "Inativo"}</Badge>
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
