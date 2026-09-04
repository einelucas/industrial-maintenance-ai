import { sectorService } from "@/features/sectors/services/sector.service";
import { equipmentService } from "@/features/equipments/services/equipment.service";
import { ElectricalPanelForm } from "@/features/electrical-panels/components/electrical-panel-form";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function NewElectricalPanelPage() {
  await requirePermission("panel:manage");
  const [sectors, equipments] = await Promise.all([sectorService.list(), equipmentService.list()]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Painéis Elétricos", href: "/electrical-panels" },
            { label: "Novo" },
          ]}
        />
        <h1 className="text-xl font-semibold">Novo painel elétrico</h1>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ElectricalPanelForm sectors={sectors} equipments={equipments} />
        </CardContent>
      </Card>
    </div>
  );
}
