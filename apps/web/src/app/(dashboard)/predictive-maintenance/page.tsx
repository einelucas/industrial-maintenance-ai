import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { RiskBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatPercent } from "@/lib/utils/format";

export default async function PredictiveMaintenancePage() {
  const equipments = await prisma.equipment.findMany({
    include: {
      sector: true,
      predictions: { orderBy: { createdAt: "desc" }, take: 1 },
      alerts: { where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const monitored = equipments.filter((e) => e.predictions.length > 0);
  const counts = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
  for (const eq of monitored) {
    const level = eq.predictions[0]?.riskLevel;
    if (level) counts[level] += 1;
  }
  const openAlerts = await prisma.alert.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } });

  const ranking = monitored
    .filter((e) => e.predictions[0])
    .sort((a, b) => b.predictions[0]!.failureProbability - a.predictions[0]!.failureProbability)
    .slice(0, 10);

  const recentPredictions = await prisma.prediction.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { equipment: true },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Manutenção Preditiva" }]} />
        <h1 className="text-xl font-semibold">Dashboard Preditivo</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{monitored.length}</div><div className="text-xs text-muted-foreground">Monitorados</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold text-status-neutral">{counts.LOW}</div><div className="text-xs text-muted-foreground">Baixo</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold text-status-attention">{counts.MODERATE}</div><div className="text-xs text-muted-foreground">Moderado</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold text-status-high">{counts.HIGH}</div><div className="text-xs text-muted-foreground">Alto</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold text-status-critical">{counts.CRITICAL}</div><div className="text-xs text-muted-foreground">Crítico</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{openAlerts}</div><div className="text-xs text-muted-foreground">Alertas abertos</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Ranking — Equipamentos com maior risco</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TAG</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Última leitura</TableHead>
                <TableHead>Probabilidade</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Alerta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma predição registrada ainda.</TableCell></TableRow>
              )}
              {ranking.map((eq) => {
                const p = eq.predictions[0]!;
                const alert = eq.alerts[0];
                return (
                  <TableRow key={eq.id}>
                    <TableCell><Link href={`/equipments/${eq.id}`} className="text-primary hover:underline">{eq.tag}</Link></TableCell>
                    <TableCell>{eq.name}</TableCell>
                    <TableCell>{eq.sector.name}</TableCell>
                    <TableCell>{formatDateTime(p.createdAt)}</TableCell>
                    <TableCell>{formatPercent(p.failureProbability)}</TableCell>
                    <TableCell><RiskBadge level={p.riskLevel} /></TableCell>
                    <TableCell>{alert ? <Badge variant="attention">{alert.status === "OPEN" ? "Aberto" : "Reconhecido"}</Badge> : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Últimas predições</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Equipamento</TableHead>
                <TableHead>Probabilidade</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Modelo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPredictions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDateTime(p.createdAt)}</TableCell>
                  <TableCell>{p.equipment?.tag ?? "—"}</TableCell>
                  <TableCell>{formatPercent(p.failureProbability)}</TableCell>
                  <TableCell><RiskBadge level={p.riskLevel} /></TableCell>
                  <TableCell className="font-mono text-xs">{p.modelVersion}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
