import { thermalPointService } from "@/features/thermal-points/services/thermal-point.service";
import { ThermalReadingForm } from "@/features/thermal-readings/components/thermal-reading-form";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function NewThermalReadingPage({ searchParams }: { searchParams: { thermalPointId?: string } }) {
  await requirePermission("thermal-reading:create");
  const points = await thermalPointService.listActive();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Leituras Termográficas", href: "/thermal-readings" },
            { label: "Registrar" },
          ]}
        />
        <h1 className="text-xl font-semibold">Registro manual de leitura</h1>
        <p className="text-sm text-muted-foreground">
          &ldquo;Manual&rdquo; descreve só a origem da medição — nunca a origem de um diagnóstico. A leitura fica{" "}
          <strong>PENDING_AI</strong> até uma inferência real do modelo.
        </p>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ThermalReadingForm points={points} defaultPointId={searchParams.thermalPointId} />
        </CardContent>
      </Card>
    </div>
  );
}
