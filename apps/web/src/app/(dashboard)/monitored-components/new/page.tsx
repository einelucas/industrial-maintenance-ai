import { electricalPanelService } from "@/features/electrical-panels/services/electrical-panel.service";
import { MonitoredComponentForm } from "@/features/monitored-components/components/monitored-component-form";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function NewMonitoredComponentPage({
  searchParams,
}: {
  searchParams: { panelId?: string };
}) {
  await requirePermission("panel:manage");
  const panels = await electricalPanelService.listActive();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Componentes Monitorados", href: "/monitored-components" },
            { label: "Novo" },
          ]}
        />
        <h1 className="text-xl font-semibold">Novo componente monitorado</h1>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <MonitoredComponentForm panels={panels} defaultPanelId={searchParams.panelId} />
        </CardContent>
      </Card>
    </div>
  );
}
