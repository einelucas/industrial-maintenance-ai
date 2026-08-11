import { equipmentService } from "@/features/equipments/services/equipment.service";
import { prisma } from "@/lib/db/client";
import { PlanForm } from "@/features/maintenance-plans/components/plan-form";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function NewPlanPage() {
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
            { label: "Novo" },
          ]}
        />
        <h1 className="text-xl font-semibold">Novo Plano Preventivo</h1>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <PlanForm equipments={equipments} planners={planners} />
        </CardContent>
      </Card>
    </div>
  );
}
