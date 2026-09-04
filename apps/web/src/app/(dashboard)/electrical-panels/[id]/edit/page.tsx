import { notFound } from "next/navigation";
import { electricalPanelService } from "@/features/electrical-panels/services/electrical-panel.service";
import { sectorService } from "@/features/sectors/services/sector.service";
import { equipmentService } from "@/features/equipments/services/equipment.service";
import { ElectricalPanelForm } from "@/features/electrical-panels/components/electrical-panel-form";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function EditElectricalPanelPage({ params }: { params: { id: string } }) {
  await requirePermission("panel:manage");
  const panel = await electricalPanelService.getOrThrow(params.id).catch(() => null);
  if (!panel) notFound();

  const [sectors, equipments] = await Promise.all([sectorService.list(), equipmentService.list()]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Painéis Elétricos", href: "/electrical-panels" },
            { label: panel.tag, href: `/electrical-panels/${panel.id}` },
            { label: "Editar" },
          ]}
        />
        <h1 className="text-xl font-semibold">Editar painel elétrico</h1>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ElectricalPanelForm sectors={sectors} equipments={equipments} mode="edit" panel={panel} />
        </CardContent>
      </Card>
    </div>
  );
}
