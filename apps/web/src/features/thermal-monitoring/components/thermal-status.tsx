import type { RiskLevel } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { RISK_LABELS } from "@/features/thermal-monitoring/services/thermal-presentation";
import { getThermalAiState } from "@/features/thermal-monitoring/services/thermal-monitoring.service";

const variants = { LOW: "neutral", MODERATE: "attention", HIGH: "high", CRITICAL: "critical" } as const;

export function ThermalRiskBadge({ risk }: { risk: RiskLevel | null }) {
  return <Badge variant={risk ? variants[risk] : "muted"}>{risk ? RISK_LABELS[risk] : "Sem análise atual"}</Badge>;
}

export async function ThermalAiBanner() {
  const ai = await getThermalAiState();
  return <div role="status" className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
    <div className="flex flex-wrap items-center gap-2"><Badge variant={ai.status === "READY" ? "neutral" : "attention"}>{ai.status}</Badge>
      <strong>{ai.status === "READY" ? "IA térmica pronta" : "Análise térmica indisponível"}</strong></div>
    <p className="mt-2 text-muted-foreground">{ai.status === "READY"
      ? `Modelo ${ai.modelVersion} · ${ai.modelStage}. A decisão e a autorização da manutenção continuam humanas.`
      : "As leituras são preservadas. Novos diagnósticos e OS preditivas ficam bloqueados. Evidências anteriores continuam disponíveis para consulta e revisão humana, identificadas como histórico."}</p>
    {ai.reason && <p className="mt-1 break-words text-xs text-muted-foreground">{ai.reason}</p>}
    {ai.modelStage === "SYNTHETIC_EXPERIMENTAL" && <p className="mt-1 text-xs">Modelo experimental treinado com dados sintéticos.</p>}
  </div>;
}
