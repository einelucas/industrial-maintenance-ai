import { thermalPointService } from "@/features/thermal-points/services/thermal-point.service";
import { ProvisionSensorDeviceForm } from "@/features/sensor-devices/components/provision-sensor-device-form";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function NewSensorDevicePage({ searchParams }: { searchParams: { thermalPointId?: string } }) {
  await requirePermission("device:manage");
  const points = await thermalPointService.listActive();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Dispositivos", href: "/sensor-devices" },
            { label: "Provisionar" },
          ]}
        />
        <h1 className="text-xl font-semibold">Provisionar dispositivo</h1>
      </div>
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <ProvisionSensorDeviceForm points={points} defaultThermalPointId={searchParams.thermalPointId} />
        </CardContent>
      </Card>
    </div>
  );
}
