import { notFound } from "next/navigation";
import { thermalPointService } from "@/features/thermal-points/services/thermal-point.service";
import { monitoredComponentService } from "@/features/monitored-components/services/monitored-component.service";
import { ThermalPointForm } from "@/features/thermal-points/components/thermal-point-form";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function EditThermalPointPage({ params }: { params: { id: string } }) {
  await requirePermission("thermal-point:manage");
  const point = await thermalPointService.getOrThrow(params.id).catch(() => null);
  if (!point) notFound();

  const components = await monitoredComponentService.listActive();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Pontos Termográficos", href: "/thermal-points" },
            { label: point.code, href: `/thermal-points/${point.id}` },
            { label: "Editar" },
          ]}
        />
        <h1 className="text-xl font-semibold">Editar ponto termográfico</h1>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ThermalPointForm components={components} mode="edit" point={point} />
        </CardContent>
      </Card>
    </div>
  );
}
