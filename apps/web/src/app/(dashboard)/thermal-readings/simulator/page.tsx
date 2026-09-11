import { notFound } from "next/navigation";
import { thermalPointService } from "@/features/thermal-points/services/thermal-point.service";
import { ThermalReadingSimulatorForm } from "@/features/thermal-readings/components/thermal-reading-simulator-form";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { FEATURE_FLAGS } from "@/config/feature-flags";

export const maxDuration = 60;

export default async function ThermalReadingSimulatorPage() {
  await requirePermission("thermal-reading:simulate");
  if (!FEATURE_FLAGS.thermalSimulatorEnabled) notFound();
  const points = await thermalPointService.listActive();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Monitoramento", href: "/thermal-monitoring" },
            { label: "Leituras Termográficas", href: "/thermal-readings" },
            { label: "Simulador" },
          ]}
        />
        <h1 className="text-xl font-semibold">Simulador de leituras</h1>
        <p className="text-sm text-muted-foreground">
          Gera telemetria determinística (mesma seed → mesma série) e grava pelo mesmo caminho real das entradas manuais/CSV. Nunca
          devolve risco, causa ou alerta pronto — só sequências de medições brutas.
        </p>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ThermalReadingSimulatorForm points={points} />
        </CardContent>
      </Card>
    </div>
  );
}
