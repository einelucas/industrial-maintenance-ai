import Link from "next/link";
import { Plus, Upload, Sparkles } from "lucide-react";
import type { AnalysisStatus, MonitoringMode } from "@prisma/client";
import { thermalReadingService } from "@/features/thermal-readings/services/thermal-reading.service";
import { thermalPointService } from "@/features/thermal-points/services/thermal-point.service";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { AnalysisStatusBadge } from "@/components/shared/status-badge";
import { DEFAULT_PAGE_SIZE, parsePage, totalPages } from "@/lib/pagination";
import { FEATURE_FLAGS } from "@/config/feature-flags";

const SOURCE_OPTIONS: MonitoringMode[] = ["MANUAL", "CSV", "SIMULATOR", "POINT_SENSOR", "THERMAL_ARRAY", "THERMAL_CAMERA"];
const ANALYSIS_STATUS_OPTIONS: AnalysisStatus[] = ["PENDING_AI", "ANALYZED", "AI_FAILED", "SUPERSEDED"];

type SearchParams = { thermalPointId?: string; source?: string; analysisStatus?: string; page?: string };

export default async function ThermalReadingsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("thermal-reading:view");
  const page = parsePage(searchParams.page);
  const points = await thermalPointService.listActive();

  const { items: readings, total } = await thermalReadingService.listFiltered({
    thermalPointId: searchParams.thermalPointId || undefined,
    source: (searchParams.source as MonitoringMode) || undefined,
    analysisStatus: (searchParams.analysisStatus as AnalysisStatus) || undefined,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Leituras Termográficas" }]} />
          <h1 className="text-xl font-semibold">Leituras Termográficas</h1>
          <p className="text-sm text-muted-foreground">
            Histórico bruto de medições — manual, CSV e simulador. Toda leitura nasce <strong>PENDING_AI</strong>; a ausência de análise
            nunca representa normalidade.
          </p>
        </div>
        <div className="flex gap-2">
          {can(user.role, "thermal-reading:create") && (
            <Button asChild variant="outline">
              <Link href="/thermal-readings/new">
                <Plus className="h-4 w-4" /> Registrar
              </Link>
            </Button>
          )}
          {can(user.role, "thermal-reading:import") && (
            <Button asChild variant="outline">
              <Link href="/thermal-readings/import">
                <Upload className="h-4 w-4" /> Importar CSV
              </Link>
            </Button>
          )}
          {can(user.role, "thermal-reading:simulate") && FEATURE_FLAGS.thermalSimulatorEnabled && (
            <Button asChild>
              <Link href="/thermal-readings/simulator">
                <Sparkles className="h-4 w-4" /> Simulador
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="thermalPointId">Ponto</Label>
              <Select id="thermalPointId" name="thermalPointId" defaultValue={searchParams.thermalPointId ?? ""} className="w-48">
                <option value="">Todos</option>
                {points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="source">Origem</Label>
              <Select id="source" name="source" defaultValue={searchParams.source ?? ""} className="w-40">
                <option value="">Todas</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="analysisStatus">Status de análise</Label>
              <Select id="analysisStatus" name="analysisStatus" defaultValue={searchParams.analysisStatus ?? ""} className="w-44">
                <option value="">Todos</option>
                {ANALYSIS_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/thermal-readings">Limpar</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medido em</TableHead>
                <TableHead>Ponto</TableHead>
                <TableHead>Máx (°C)</TableHead>
                <TableHead>ΔT (°C)</TableHead>
                <TableHead className="hidden sm:table-cell">Elevação s/ ambiente (°C)</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Análise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhuma leitura encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {readings.map((reading) => (
                <TableRow key={reading.id}>
                  <TableCell className="text-xs">{reading.measuredAt.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/thermal-points/${reading.thermalPointId}`} className="text-primary hover:underline">
                      {reading.thermalPoint.code}
                    </Link>
                  </TableCell>
                  <TableCell>{reading.temperatureMaxC.toFixed(1)}</TableCell>
                  <TableCell>{reading.deltaTC !== null ? reading.deltaTC.toFixed(1) : "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {reading.riseAboveAmbientC !== null ? reading.riseAboveAmbientC.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{reading.source}</Badge>
                  </TableCell>
                  <TableCell>
                    <AnalysisStatusBadge status={reading.analysisStatus as AnalysisStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages(total)} basePath="/thermal-readings" searchParams={searchParams} />
        </CardContent>
      </Card>
    </div>
  );
}
