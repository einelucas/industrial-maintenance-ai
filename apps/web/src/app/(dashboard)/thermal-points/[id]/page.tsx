import Link from "next/link";
import { notFound } from "next/navigation";
import { thermalPointService } from "@/features/thermal-points/services/thermal-point.service";
import { toggleActiveThermalPointAction } from "@/features/thermal-points/actions/toggle-active-thermal-point.action";
import { thermalReadingService } from "@/features/thermal-readings/services/thermal-reading.service";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { AwaitingAiAnalysisBadge, AnalysisStatusBadge } from "@/components/shared/status-badge";
import type { AnalysisStatus } from "@prisma/client";

export default async function ThermalPointDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePermission("thermal-point:view");
  const point = await thermalPointService.getOrThrow(params.id).catch(() => null);
  if (!point) notFound();

  const readingsCount = await thermalPointService.countReadings(point.id);
  const recentReadings = await thermalReadingService.listRecentForPoint(point.id, 10);
  const canManage = can(user.role, "thermal-point:manage");
  const canCreateReading = can(user.role, "thermal-reading:create");
  const latestPrediction = point.predictions[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Pontos Termográficos", href: "/thermal-points" },
              { label: point.code },
            ]}
          />
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              {point.code} — {point.name}
            </h1>
            <Badge variant={point.active ? "neutral" : "muted"}>{point.active ? "Ativo" : "Inativo"}</Badge>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/thermal-points/${point.id}/edit`}>Editar</Link>
            </Button>
            <form action={toggleActiveThermalPointAction}>
              <input type="hidden" name="pointId" value={point.id} />
              <input type="hidden" name="nextActive" value={(!point.active).toString()} />
              <Button type="submit" variant={point.active ? "destructive" : "outline"}>
                {point.active ? "Inativar" : "Reativar"}
              </Button>
            </form>
          </div>
        )}
      </div>

      <Button asChild><Link href={`/thermal-monitoring/points/${point.id}`}>Abrir monitoramento e evidências</Link></Button>
      <Card>
        <CardHeader>
          <CardTitle>Estado analítico</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm">
          {latestPrediction ? (
            <span className="text-muted-foreground">Última análise em {latestPrediction.createdAt.toLocaleString("pt-BR")}.</span>
          ) : (
            <>
              <AwaitingAiAnalysisBadge />
              <span className="text-muted-foreground">
                Nenhuma inferência real da IA foi executada para este ponto ainda. Este estado nunca deve ser lido como
                &ldquo;normal&rdquo;.
              </span>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Componente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link href={`/monitored-components/${point.component.id}`} className="text-primary hover:underline">
              {point.component.tag}
            </Link>{" "}
            — {point.component.panel.tag} / {point.component.panel.sector.name}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Modo de monitoramento</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{point.monitoringMode}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leituras persistidas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{readingsCount.toLocaleString("pt-BR")}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dispositivos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{point.devices.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Emissividade</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{point.emissivity ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Limite absoluto</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{point.absoluteLimitC ? `${point.absoluteLimitC} °C` : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ΔT atenção / alto / crítico</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {point.deltaTAttentionC ?? "—"} / {point.deltaTHighC ?? "—"} / {point.deltaTCriticalC ?? "—"} °C
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Intervalo de amostragem</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{point.sampleIntervalSec}s</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referência</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{point.referenceDescription ?? "—"}</CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Leituras recentes</CardTitle>
          {canCreateReading && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/thermal-readings/new?thermalPointId=${point.id}`}>Registrar leitura</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medido em</TableHead>
                <TableHead>Máx (°C)</TableHead>
                <TableHead>ΔT (°C)</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Análise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentReadings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhuma leitura registrada para este ponto ainda.
                  </TableCell>
                </TableRow>
              )}
              {recentReadings.map((reading) => (
                <TableRow key={reading.id}>
                  <TableCell className="text-xs">{reading.measuredAt.toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{reading.temperatureMaxC.toFixed(1)}</TableCell>
                  <TableCell>{reading.deltaTC !== null ? reading.deltaTC.toFixed(1) : "—"}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
