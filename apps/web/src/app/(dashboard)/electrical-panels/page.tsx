import Link from "next/link";
import { Plus } from "lucide-react";
import type { PanelType } from "@prisma/client";
import { electricalPanelService } from "@/features/electrical-panels/services/electrical-panel.service";
import { sectorService } from "@/features/sectors/services/sector.service";
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

const PANEL_TYPE_OPTIONS: PanelType[] = ["MCC", "DISTRIBUTION", "CONTROL", "PROTECTION", "OTHER"];

type SearchParams = { search?: string; panelType?: string; sectorId?: string; page?: string };

export default async function ElectricalPanelsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("panel:view");
  const page = parsePage(searchParams.page);
  const sectors = await sectorService.list();

  const { items: panels, total } = await electricalPanelService.listFiltered({
    search: searchParams.search || undefined,
    panelType: (searchParams.panelType as PanelType) || undefined,
    sectorId: searchParams.sectorId || undefined,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Painéis Elétricos" }]} />
          <h1 className="text-xl font-semibold">Painéis Elétricos</h1>
        </div>
        {can(user.role, "panel:manage") && (
          <Button asChild>
            <Link href="/electrical-panels/new">
              <Plus className="h-4 w-4" /> Novo painel
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
              <Label htmlFor="panelType">Tipo</Label>
              <Select id="panelType" name="panelType" defaultValue={searchParams.panelType ?? ""} className="w-40">
                <option value="">Todos</option>
                {PANEL_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sectorId">Setor</Label>
              <Select id="sectorId" name="sectorId" defaultValue={searchParams.sectorId ?? ""} className="w-40">
                <option value="">Todos</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/electrical-panels">Limpar</Link>
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
                <TableHead className="hidden sm:table-cell">Setor</TableHead>
                <TableHead className="hidden sm:table-cell">Equipamento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Componentes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {panels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhum painel encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {panels.map((panel) => (
                <TableRow key={panel.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/electrical-panels/${panel.id}`} className="text-primary hover:underline">
                      {panel.tag}
                    </Link>
                  </TableCell>
                  <TableCell>{panel.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{panel.sector.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{panel.equipment?.tag ?? "—"}</TableCell>
                  <TableCell>{panel.panelType}</TableCell>
                  <TableCell>{panel._count.components}</TableCell>
                  <TableCell>
                    <Badge variant={panel.active ? "neutral" : "muted"}>{panel.active ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/electrical-panels/${panel.id}/edit`} className="text-primary hover:underline">
                      Editar
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages(total)} basePath="/electrical-panels" searchParams={searchParams} />
        </CardContent>
      </Card>
    </div>
  );
}
