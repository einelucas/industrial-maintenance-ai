import { equipmentService } from "@/features/equipments/services/equipment.service";
import { prisma } from "@/lib/db/client";
import { WorkOrderForm } from "@/features/work-orders/components/work-order-form";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: { equipmentId?: string; type?: string; sourcePredictionId?: string };
}) {
  const [equipments, technicians] = await Promise.all([
    equipmentService.list(),
    prisma.user.findMany({ where: { role: "TECHNICIAN", active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Ordens de Serviço", href: "/work-orders" },
            { label: "Nova" },
          ]}
        />
        <h1 className="text-xl font-semibold">Nova Ordem de Serviço</h1>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <WorkOrderForm
            equipments={equipments}
            technicians={technicians}
            defaultEquipmentId={searchParams.equipmentId}
            defaultType={searchParams.type}
            sourcePredictionId={searchParams.sourcePredictionId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
