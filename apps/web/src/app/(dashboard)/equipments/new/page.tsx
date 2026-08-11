import { sectorService } from "@/features/sectors/services/sector.service";
import { EquipmentForm } from "@/features/equipments/components/equipment-form";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function NewEquipmentPage() {
  const sectors = await sectorService.list();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Equipamentos", href: "/equipments" },
            { label: "Novo" },
          ]}
        />
        <h1 className="text-xl font-semibold">Novo equipamento</h1>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <EquipmentForm sectors={sectors} />
        </CardContent>
      </Card>
    </div>
  );
}
