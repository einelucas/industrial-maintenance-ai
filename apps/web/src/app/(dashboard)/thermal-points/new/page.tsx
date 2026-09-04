import { monitoredComponentService } from "@/features/monitored-components/services/monitored-component.service";
import { ThermalPointForm } from "@/features/thermal-points/components/thermal-point-form";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function NewThermalPointPage({ searchParams }: { searchParams: { componentId?: string } }) {
  await requirePermission("thermal-point:manage");
  const components = await monitoredComponentService.listActive();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Pontos Termográficos", href: "/thermal-points" },
            { label: "Novo" },
          ]}
        />
        <h1 className="text-xl font-semibold">Novo ponto termográfico</h1>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ThermalPointForm components={components} defaultComponentId={searchParams.componentId} />
        </CardContent>
      </Card>
    </div>
  );
}
