import { notFound } from "next/navigation";
import { monitoredComponentService } from "@/features/monitored-components/services/monitored-component.service";
import { electricalPanelService } from "@/features/electrical-panels/services/electrical-panel.service";
import { MonitoredComponentForm } from "@/features/monitored-components/components/monitored-component-form";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function EditMonitoredComponentPage({ params }: { params: { id: string } }) {
  await requirePermission("panel:manage");
  const component = await monitoredComponentService.getOrThrow(params.id).catch(() => null);
  if (!component) notFound();

  const panels = await electricalPanelService.listActive();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Componentes Monitorados", href: "/monitored-components" },
            { label: component.tag, href: `/monitored-components/${component.id}` },
            { label: "Editar" },
          ]}
        />
        <h1 className="text-xl font-semibold">Editar componente monitorado</h1>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <MonitoredComponentForm panels={panels} mode="edit" component={component} />
        </CardContent>
      </Card>
    </div>
  );
}
