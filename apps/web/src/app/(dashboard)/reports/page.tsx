import { FileText } from "lucide-react";
import { workOrderRepository } from "@/features/work-orders/repositories/work-order.repository";
import { equipmentService } from "@/features/equipments/services/equipment.service";
import { requirePermission } from "@/lib/auth/session";
import { EntityReportPicker } from "@/features/reports/components/entity-report-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatDate } from "@/lib/utils/format";

function ReportCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}

export default async function ReportsPage() {
  await requirePermission("report:view");

  const [workOrders, equipments] = await Promise.all([workOrderRepository.findAll(), equipmentService.list()]);

  const now = new Date();
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");
  const defaultYear = String(now.getFullYear());
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultStart = thirtyDaysAgo.toISOString().slice(0, 10);
  const defaultEnd = now.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Relatórios" }]} />
        <h1 className="text-xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Geração de relatórios em PDF (@react-pdf/renderer).</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReportCard title="Relatório da OS" description="Detalhes completos de uma ordem de serviço específica.">
          <EntityReportPicker
            placeholder="Selecione uma OS..."
            options={workOrders.map((wo) => ({ value: wo.id, label: `${wo.number} — ${wo.title}` }))}
            hrefTemplate="/api/reports/work-orders/{id}"
          />
        </ReportCard>

        <ReportCard title="Histórico do equipamento" description="Todas as intervenções e predições de um equipamento.">
          <EntityReportPicker
            placeholder="Selecione um equipamento..."
            options={equipments.map((eq) => ({ value: eq.id, label: `${eq.tag} — ${eq.name}` }))}
            hrefTemplate="/api/reports/equipments/{id}/history"
          />
        </ReportCard>

        <ReportCard title="Ordens por período" description="Ordens de serviço criadas em um intervalo de datas.">
          <form action="/api/reports/work-orders/period" method="GET" target="_blank" className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="period-start">De</Label>
                <Input id="period-start" name="start" type="date" required defaultValue={defaultStart} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="period-end">Até</Label>
                <Input id="period-end" name="end" type="date" required defaultValue={defaultEnd} />
              </div>
            </div>
            <Button type="submit" variant="outline">Baixar PDF</Button>
          </form>
        </ReportCard>

        <ReportCard title="Ordens atrasadas" description="Lista consolidada de OS em atraso.">
          <Button asChild variant="outline">
            <a href="/api/reports/work-orders/overdue" target="_blank" rel="noopener noreferrer">
              Baixar PDF
            </a>
          </Button>
        </ReportCard>

        <ReportCard title="Resumo mensal" description="Indicadores consolidados do mês.">
          <form action="/api/reports/monthly-summary" method="GET" target="_blank" className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="summary-month">Mês</Label>
                <Select id="summary-month" name="month" defaultValue={defaultMonth}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                      {formatDate(new Date(2000, i, 1), "MMMM")}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="summary-year">Ano</Label>
                <Input id="summary-year" name="year" type="number" defaultValue={defaultYear} />
              </div>
            </div>
            <Button type="submit" variant="outline">Baixar PDF</Button>
          </form>
        </ReportCard>

        <ReportCard title="Relatório preditivo térmico" description="Aguardando a integração do modelo real e os relatórios da Etapa 10.">
          <p className="text-sm text-muted-foreground">Evidências individuais disponíveis no monitoramento térmico. Nenhum relatório mecânico é reutilizado como resultado termográfico.</p>
        </ReportCard>
      </div>
    </div>
  );
}
