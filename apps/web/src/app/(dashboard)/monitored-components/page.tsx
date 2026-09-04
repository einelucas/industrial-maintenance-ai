import Link from "next/link";
import { Plus } from "lucide-react";
import type { ElectricalComponentType } from "@prisma/client";
import { monitoredComponentService } from "@/features/monitored-components/services/monitored-component.service";
import { electricalPanelService } from "@/features/electrical-panels/services/electrical-panel.service";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DEFAULT_PAGE_SIZE, parsePage, totalPages } from "@/lib/pagination";

const COMPONENT_TYPE_OPTIONS: ElectricalComponentType[] = [
  "CIRCUIT_BREAKER",
  "CONTACTOR",
  "THERMAL_RELAY",
  "TERMINAL",
  "BUSBAR",
  "FUSE",
  "CABLE_CONNECTION",
  "POWER_SUPPLY",
  "DRIVE",
  "OTHER",
];

type SearchParams = { search?: string; componentType?: string; panelId?: string; page?: string };

export default async function MonitoredComponentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("panel:view");
  const page = parsePage(searchParams.page);
  const panels = await electricalPanelService.listActive();

  const { items: components, total } = await monitoredComponentService.listFiltered({
    search: searchParams.search || undefined,
    componentType: (searchParams.componentType as ElectricalComponentType) || undefined,
    panelId: searchParams.panelId || undefined,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Componentes Monitorados" }]} />
          <h1 className="text-xl font-semibold">Componentes Monitorados</h1>
        </div>
        {can(user.role, "panel:manage") && (
          <Button asChild>
            <Link href="/monitored-components/new">
              <Plus className="h-4 w-4" /> Novo componente
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="search">Buscar</Label>
              <Input id="search" name="search" placeholder="TAG ou nome..." defaultValue={searchParams.search ?? ""} className="w-56" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="componentType">Tipo</Label>
              <Select id="componentType" name="componentType" defaultValue={searchParams.componentType ?? ""} className="w-44">
                <option value="">Todos</option>
                {COMPONENT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="panelId">Painel</Label>
              <Select id="panelId" name="panelId" defaultValue={searchParams.panelId ?? ""} className="w-44">
                <option value="">Todos</option>
                {panels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.tag}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/monitored-components">Limpar</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TAG</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Painel</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Pontos</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {components.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum componente encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {components.map((component) => (
                <TableRow key={component.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/monitored-components/${component.id}`} className="text-primary hover:underline">
                      {component.tag}
                    </Link>
                  </TableCell>
                  <TableCell>{component.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{component.panel.tag}</TableCell>
                  <TableCell>{component.componentType}</TableCell>
                  <TableCell>{component._count.thermalPoints}</TableCell>
                  <TableCell>
                    <Badge variant={component.active ? "neutral" : "muted"}>{component.active ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages(total)} basePath="/monitored-components" searchParams={searchParams} />
        </CardContent>
      </Card>
    </div>
  );
}
