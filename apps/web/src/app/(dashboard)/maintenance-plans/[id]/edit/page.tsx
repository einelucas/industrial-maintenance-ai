import { notFound } from "next/navigation";
import { maintenancePlanService } from "@/features/maintenance-plans/services/maintenance-plan.service";
import { equipmentService } from "@/features/equipments/services/equipment.service";
import { prisma } from "@/lib/db/client";
import { PlanForm } from "@/features/maintenance-plans/components/plan-form";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function EditPlanPage({ params }: { params: { id: string } }) {
  const plan = await maintenancePlanService.getOrThrow(params.id).catch(() => null);
  if (!plan) notFound();

  const [equipments, planners] = await Promise.all([
    equipmentService.list(),
    prisma.user.findMany({ where: { role: { in: ["PLANNER", "TECHNICIAN"] }, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Planos Preventivos", href: "/maintenance-plans" },
            { label: plan.name, href: `/maintenance-plans/${plan.id}` },
            { label: "Editar" },
          ]}
        />
        <h1 className="text-xl font-semibold">Editar plano preventivo</h1>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <PlanForm equipments={equipments} planners={planners} mode="edit" plan={plan} />
        </CardContent>
      </Card>
    </div>
  );
}
