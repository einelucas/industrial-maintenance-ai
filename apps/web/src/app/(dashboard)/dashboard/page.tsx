import { dashboardService } from "@/features/dashboard/services/dashboard.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { BarChartCard, GroupedBarChartCard, PieChartCard, LineChartCard } from "@/features/dashboard/components/charts";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberta", PLANNED: "Planejada", IN_PROGRESS: "Em andamento",
  WAITING_MATERIAL: "Aguard. material", PAUSED: "Pausada", COMPLETED: "Concluída", CANCELED: "Cancelada",
};
const TYPE_LABEL: Record<string, string> = {
  CORRECTIVE: "Corretiva", PREVENTIVE: "Preventiva", PREDICTIVE: "Preditiva",
  INSPECTION: "Inspeção", IMPROVEMENT: "Melhoria",
};

export default async function DashboardPage() {
  const [cards, byStatus, byType, monthly, topEquipments, riskDistribution] = await Promise.all([
    dashboardService.getSummaryCards(),
    dashboardService.getWorkOrdersByStatus(),
    dashboardService.getWorkOrdersByType(),
    dashboardService.getMonthlyOpenVsCompleted(),
    dashboardService.getTopEquipmentsByInterventions(),
    dashboardService.getRiskDistribution(),
  ]);

  const cardItems = [
    { label: "Equipamentos ativos", value: cards.activeEquipments },
    { label: "OS abertas", value: cards.openWO },
    { label: "OS em andamento", value: cards.inProgressWO },
    { label: "OS atrasadas", value: cards.delayedWO },
    { label: "OS concluídas", value: cards.completedWO },
    { label: "Alertas preditivos", value: cards.openAlerts },
    { label: "Equipamentos de alto risco", value: cards.highRiskEquipments },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs items={[{ label: "Dashboard" }]} />
        <h1 className="text-xl font-semibold">Visão Geral</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {cardItems.map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-6">
              <div className="text-2xl font-semibold">{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>OS por status</CardTitle></CardHeader>
          <CardContent>
            <BarChartCard data={byStatus.map((s) => ({ ...s, statusLabel: STATUS_LABEL[s.status] }))} xKey="statusLabel" yKey="count" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Preventiva x Corretiva x Preditiva</CardTitle></CardHeader>
          <CardContent>
            <PieChartCard
              data={byType.map((t) => ({ name: TYPE_LABEL[t.type], count: t.count }))}
              dataKey="count"
              nameKey="name"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>OS abertas x concluídas por mês</CardTitle></CardHeader>
          <CardContent>
            <GroupedBarChartCard
              data={monthly}
              xKey="month"
              bars={[
                { key: "abertas", color: "#2a5f8f", label: "Abertas" },
                { key: "concluidas", color: "#4c9a70", label: "Concluídas" },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Equipamentos com mais intervenções</CardTitle></CardHeader>
          <CardContent>
            <BarChartCard data={topEquipments} xKey="tag" yKey="count" color="#e07b2e" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Risco dos equipamentos</CardTitle></CardHeader>
          <CardContent>
            <PieChartCard data={riskDistribution.filter((r) => r.count > 0)} dataKey="count" nameKey="level" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
