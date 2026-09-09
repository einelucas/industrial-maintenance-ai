import Link from "next/link";
import { Plus } from "lucide-react";
import type { MonitoringMode } from "@prisma/client";
import { thermalPointService } from "@/features/thermal-points/services/thermal-point.service";
import { monitoredComponentService } from "@/features/monitored-components/services/monitored-component.service";
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
import { AwaitingAiAnalysisBadge } from "@/components/shared/status-badge";
import { DEFAULT_PAGE_SIZE, parsePage, totalPages } from "@/lib/pagination";

const MODE_OPTIONS: MonitoringMode[] = ["MANUAL", "CSV", "SIMULATOR", "POINT_SENSOR", "THERMAL_ARRAY", "THERMAL_CAMERA"];

type SearchParams = { search?: string; componentId?: string; monitoringMode?: string; page?: string };

export default async function ThermalPointsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("thermal-point:view");
  const page = parsePage(searchParams.page);
  const components = await monitoredComponentService.listActive();

  const { items: points, total } = await thermalPointService.listFiltered({
    search: searchParams.search || undefined,
    componentId: searchParams.componentId || undefined,
    monitoringMode: (searchParams.monitoringMode as MonitoringMode) || undefined,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Pontos Termográficos" }]} />
          <h1 className="text-xl font-semibold">Pontos Termográficos</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro estrutural dos pontos de inspeção. O estado de risco depende de uma inferência real da IA (etapa
            futura) — enquanto isso, todos os pontos aguardam análise.
          </p>
        </div>
        {can(user.role, "thermal-point:manage") && (
          <Button asChild>
            <Link href="/thermal-points/new">
              <Plus className="h-4 w-4" /> Novo ponto
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="search">Buscar</Label>
              <Input id="search" name="search" placeholder="Código ou nome..." defaultValue={searchParams.search ?? ""} className="w-56" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="componentId">Componente</Label>
              <Select id="componentId" name="componentId" defaultValue={searchParams.componentId ?? ""} className="w-44">
                <option value="">Todos</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.tag}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="monitoringMode">Modo</Label>
              <Select id="monitoringMode" name="monitoringMode" defaultValue={searchParams.monitoringMode ?? ""} className="w-40">
                <option value="">Todos</option>
                {MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/thermal-points">Limpar</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Componente</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Dispositivos</TableHead>
                <TableHead>Histórico da IA</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhum ponto encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {points.map((point) => (
                <TableRow key={point.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/thermal-points/${point.id}`} className="text-primary hover:underline">
                      {point.code}
                    </Link>
                  </TableCell>
                  <TableCell>{point.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{point.component.tag}</TableCell>
                  <TableCell>{point.monitoringMode}</TableCell>
                  <TableCell>{point.devices.length}</TableCell>
                  <TableCell>
                    {point.predictions.length === 0 ? <AwaitingAiAnalysisBadge /> : <Badge variant="muted">Possui histórico</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={point.active ? "neutral" : "muted"}>{point.active ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages(total)} basePath="/thermal-points" searchParams={searchParams} />
        </CardContent>
      </Card>
    </div>
  );
}
