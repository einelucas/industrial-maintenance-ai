import Link from "next/link";
import { Plus } from "lucide-react";
import type { EquipmentCriticality, EquipmentStatus } from "@prisma/client";
import { equipmentService } from "@/features/equipments/services/equipment.service";
import { sectorService } from "@/features/sectors/services/sector.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { EquipmentStatusBadge } from "@/components/shared/status-badge";
import { DEFAULT_PAGE_SIZE, parsePage, totalPages } from "@/lib/pagination";

const STATUS_OPTIONS: EquipmentStatus[] = ["OPERATIONAL", "MAINTENANCE", "STOPPED", "INACTIVE"];
const CRITICALITY_OPTIONS: EquipmentCriticality[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

type SearchParams = { search?: string; status?: string; criticality?: string; sectorId?: string; page?: string };

export default async function EquipmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const page = parsePage(searchParams.page);
  const sectors = await sectorService.list();

  const { items: equipments, total } = await equipmentService.listFiltered({
    search: searchParams.search || undefined,
    status: (searchParams.status as EquipmentStatus) || undefined,
    criticality: (searchParams.criticality as EquipmentCriticality) || undefined,
    sectorId: searchParams.sectorId || undefined,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Equipamentos" }]} />
          <h1 className="text-xl font-semibold">Equipamentos</h1>
        </div>
        <Button asChild>
          <Link href="/equipments/new">
            <Plus className="h-4 w-4" /> Novo equipamento
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="search">Buscar</Label>
              <Input id="search" name="search" placeholder="TAG ou nome..." defaultValue={searchParams.search ?? ""} className="w-56" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={searchParams.status ?? ""} className="w-40">
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="criticality">Criticidade</Label>
              <Select id="criticality" name="criticality" defaultValue={searchParams.criticality ?? ""} className="w-40">
                <option value="">Todas</option>
                {CRITICALITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sectorId">Setor</Label>
              <Select id="sectorId" name="sectorId" defaultValue={searchParams.sectorId ?? ""} className="w-40">
                <option value="">Todos</option>
                {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/equipments">Limpar</Link>
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
                <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                <TableHead>Criticidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhum equipamento encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {equipments.map((equipment) => (
                <TableRow key={equipment.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/equipments/${equipment.id}`} className="text-primary hover:underline">
                      {equipment.tag}
                    </Link>
                  </TableCell>
                  <TableCell>{equipment.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{equipment.sector.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{equipment.category}</TableCell>
                  <TableCell>{equipment.criticality}</TableCell>
                  <TableCell>
                    <EquipmentStatusBadge status={equipment.status} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/equipments/${equipment.id}/edit`} className="text-primary hover:underline">
                      Editar
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages(total)} basePath="/equipments" searchParams={searchParams} />
        </CardContent>
      </Card>
    </div>
  );
}
