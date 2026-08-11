import Link from "next/link";
import { Plus } from "lucide-react";
import type { FrequencyType } from "@prisma/client";
import { maintenancePlanService } from "@/features/maintenance-plans/services/maintenance-plan.service";
import { generateWorkOrderFromPlanAction } from "@/features/maintenance-plans/actions/generate-work-order.action";
import { runSchedulerAction } from "@/features/maintenance-plans/actions/run-scheduler.action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatDate } from "@/lib/utils/format";
import { DEFAULT_PAGE_SIZE, parsePage, totalPages } from "@/lib/pagination";

const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: "Diária",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  CUSTOM_DAYS: "Personalizada (dias)",
};

const FREQUENCY_OPTIONS: FrequencyType[] = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "CUSTOM_DAYS"];

type SearchParams = { search?: string; frequencyType?: string; page?: string };

export default async function MaintenancePlansPage({ searchParams }: { searchParams: SearchParams }) {
  const page = parsePage(searchParams.page);

  const { items: plans, total } = await maintenancePlanService.listFiltered({
    search: searchParams.search || undefined,
    frequencyType: (searchParams.frequencyType as FrequencyType) || undefined,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Planos Preventivos" }]} />
          <h1 className="text-xl font-semibold">Planos Preventivos</h1>
        </div>
        <div className="flex gap-2">
          <form action={runSchedulerAction}>
            <Button type="submit" variant="outline">
              Executar verificação agora
            </Button>
          </form>
          <Button asChild>
            <Link href="/maintenance-plans/new">
              <Plus className="h-4 w-4" /> Novo plano
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="search">Buscar</Label>
              <Input id="search" name="search" placeholder="Nome do plano ou TAG..." defaultValue={searchParams.search ?? ""} className="w-56" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="frequencyType">Frequência</Label>
              <Select id="frequencyType" name="frequencyType" defaultValue={searchParams.frequencyType ?? ""} className="w-44">
                <option value="">Todas</option>
                {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/maintenance-plans">Limpar</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Equipamento</TableHead>
                <TableHead className="hidden sm:table-cell">Frequência</TableHead>
                <TableHead>Próxima execução</TableHead>
                <TableHead className="hidden sm:table-cell">Responsável padrão</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum plano preventivo encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <Link href={`/maintenance-plans/${plan.id}`} className="text-primary hover:underline">
                      {plan.name}
                    </Link>
                  </TableCell>
                  <TableCell>{plan.equipment.tag}</TableCell>
                  <TableCell className="hidden sm:table-cell">{FREQUENCY_LABEL[plan.frequencyType]}</TableCell>
                  <TableCell>{formatDate(plan.nextExecution)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{plan.defaultAssignee?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <form action={generateWorkOrderFromPlanAction}>
                        <input type="hidden" name="planId" value={plan.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Gerar OS
                        </Button>
                      </form>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/maintenance-plans/${plan.id}/edit`}>Editar</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages(total)} basePath="/maintenance-plans" searchParams={searchParams} />
        </CardContent>
      </Card>
    </div>
  );
}
