import Link from "next/link";
import { notFound } from "next/navigation";
import { maintenancePlanService } from "@/features/maintenance-plans/services/maintenance-plan.service";
import { generateWorkOrderFromPlanAction } from "@/features/maintenance-plans/actions/generate-work-order.action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatDate } from "@/lib/utils/format";

const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: "Diária",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  CUSTOM_DAYS: "Personalizada (dias)",
};

export default async function PlanDetailPage({ params }: { params: { id: string } }) {
  const plan = await maintenancePlanService.getOrThrow(params.id).catch(() => null);
  if (!plan) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Planos Preventivos", href: "/maintenance-plans" },
              { label: plan.name },
            ]}
          />
          <h1 className="text-xl font-semibold">{plan.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/maintenance-plans/${plan.id}/edit`}>Editar</Link>
          </Button>
          <form action={generateWorkOrderFromPlanAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <Button type="submit">Gerar OS</Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Equipamento</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <Link href={`/equipments/${plan.equipment.id}`} className="text-primary hover:underline">
              {plan.equipment.tag} — {plan.equipment.name}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Frequência</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {FREQUENCY_LABEL[plan.frequencyType]} (a cada {plan.frequencyValue})
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Próxima execução</CardTitle></CardHeader>
          <CardContent className="text-sm">{formatDate(plan.nextExecution)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Horas estimadas</CardTitle></CardHeader>
          <CardContent className="text-sm">{plan.estimatedHours ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent className="text-sm">{plan.active ? "Ativo" : "Inativo"}</CardContent>
        </Card>
      </div>

      {plan.description && (
        <Card>
          <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{plan.description}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Checklist</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {plan.checklistItems.length === 0 ? (
            <p className="text-muted-foreground">Nenhum item de checklist definido.</p>
          ) : (
            <ol className="list-inside list-decimal space-y-1">
              {plan.checklistItems.map((item) => (
                <li key={item.id}>{item.description}</li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
