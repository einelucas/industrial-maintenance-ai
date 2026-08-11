import { riskThresholdService } from "@/features/settings/services/risk-threshold.service";
import { requirePermission } from "@/lib/auth/session";
import { RiskThresholdForm } from "@/features/settings/components/risk-threshold-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function SettingsPage() {
  await requirePermission("settings:manage");
  const thresholds = await riskThresholdService.get();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Configurações" }]} />
        <h1 className="text-xl font-semibold">Configurações</h1>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Faixas de risco</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define os cortes de probabilidade de falha usados pelo serviço de manutenção preditiva para classificar o
            risco em Baixo, Moderado, Alto ou Crítico.
          </p>
        </CardHeader>
        <CardContent>
          <RiskThresholdForm lowMax={thresholds.lowMax} moderateMax={thresholds.moderateMax} highMax={thresholds.highMax} />
        </CardContent>
      </Card>
    </div>
  );
}
