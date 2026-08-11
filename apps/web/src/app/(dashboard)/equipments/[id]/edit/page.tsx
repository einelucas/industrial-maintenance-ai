import { notFound } from "next/navigation";
import { equipmentService } from "@/features/equipments/services/equipment.service";
import { sectorService } from "@/features/sectors/services/sector.service";
import { EquipmentForm } from "@/features/equipments/components/equipment-form";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function EditEquipmentPage({ params }: { params: { id: string } }) {
  const equipment = await equipmentService.getOrThrow(params.id).catch(() => null);
  if (!equipment) notFound();

  const sectors = await sectorService.list();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Equipamentos", href: "/equipments" },
            { label: equipment.tag, href: `/equipments/${equipment.id}` },
            { label: "Editar" },
          ]}
        />
        <h1 className="text-xl font-semibold">Editar equipamento</h1>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <EquipmentForm sectors={sectors} mode="edit" equipment={equipment} />
        </CardContent>
      </Card>
    </div>
  );
}
