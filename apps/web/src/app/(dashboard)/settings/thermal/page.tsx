import type { ElectricalComponentType } from "@prisma/client";
import { thermalSettingsService } from "@/features/thermal-settings/services/thermal-settings.service";
import { GlobalThermalConfigForm } from "@/features/thermal-settings/components/global-thermal-config-form";
import { ComponentTypeThermalConfigRow } from "@/features/thermal-settings/components/component-type-thermal-config-row";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

const COMPONENT_TYPES: ElectricalComponentType[] = [
  "CIRCUIT_BREAKER",
  "CONTACTOR",
  "THERMAL_RELAY",
  "TERMINAL",
  "BUSBAR",
  "FUSE",
  "CABLE_CONNECTION",
  "POWER_SUPPLY",
  "DRIVE",
  "OTHER",
];

export default async function ThermalSettingsPage() {
  await requirePermission("thermal-settings:manage");

  const [global, componentTypeConfigs] = await Promise.all([
    thermalSettingsService.getGlobal(),
    thermalSettingsService.getAllComponentTypeConfigs(),
  ]);
  const configByType = new Map(componentTypeConfigs.map((c) => [c.componentType, c]));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Configurações", href: "/settings" },
            { label: "Térmico" },
          ]}
        />
        <h1 className="text-xl font-semibold">Configurações Térmicas</h1>
        <p className="text-sm text-muted-foreground">
          Precedência de resolução: override do ponto → tipo de componente → global → padrão do sistema. Estes
          limites são apenas contexto de engenharia/plausibilidade — nunca geram diagnóstico, risco ou incidente por
          si só; isso depende de uma inferência real da IA (etapa futura).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração global</CardTitle>
        </CardHeader>
        <CardContent>
          <GlobalThermalConfigForm config={global} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Override por tipo de componente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead colSpan={5}>Limite absoluto / ΔT atenção / ΔT alto / ΔT crítico (vazio = herda da global)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPONENT_TYPES.map((type) => (
                <ComponentTypeThermalConfigRow key={type} componentType={type} config={configByType.get(type)} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
