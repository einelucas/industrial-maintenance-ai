import { AlertTriangle, Factory, ScanLine, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GPMS_SCOPE } from "@/features/gpms-scope/constants";

const scopeIndicators = [
  { label: "Pontos inspecionados", value: String(GPMS_SCOPE.inspectedPoints), icon: ScanLine },
  { label: "Achados históricos", value: String(GPMS_SCOPE.historicalAnomalies), icon: AlertTriangle },
  {
    label: "Caso crítico de referência",
    value: `${String(GPMS_SCOPE.criticalTemperatureC).replace(".", ",")} °C`,
    detail: `referência ${GPMS_SCOPE.criticalReferenceTemperatureC} °C`,
    icon: Target,
  },
  { label: "Centrífugas na planta", value: `+${GPMS_SCOPE.minimumCentrifuges}`, icon: Factory },
] as const;

export function GpmsScopeSummary() {
  return (
    <Card className="overflow-hidden border-primary/20 shadow-none">
      <CardHeader className="gap-2 border-b bg-primary/[0.04] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            Referência inicial do desafio
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Base histórica fixa; não representa o risco operacional atual.
          </p>
        </div>
        <Badge>{GPMS_SCOPE.program} · {GPMS_SCOPE.title}</Badge>
      </CardHeader>
      <CardContent className="pt-4">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {scopeIndicators.map((indicator) => (
            <div key={indicator.label} className="flex min-w-0 items-start gap-3 rounded-md border bg-background p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <indicator.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{indicator.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold leading-tight">{indicator.value}</dd>
                {"detail" in indicator && indicator.detail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{indicator.detail}</p>
                )}
              </div>
            </div>
          ))}
        </dl>
        <div className="mt-4 space-y-1 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Objetivo:</strong> {GPMS_SCOPE.objective}</p>
          <p>O produto complementa a termografia existente com monitoramento contínuo, inteligência de dados,
            rastreabilidade por TAG e priorização empresarial P5–P100, mantendo a decisão de manutenção humana.</p>
          <p className="font-medium text-foreground">Esta é uma referência histórica fixa e não representa o risco operacional atual.</p>
          <p className="text-xs">A demonstração de software não comprova a segurança da instalação física dos sensores nem a eficácia industrial; esses pontos dependem de piloto e validação em campo.</p>
        </div>
      </CardContent>
    </Card>
  );
}
