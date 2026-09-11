import Link from "next/link";
import { X } from "lucide-react";
import { CONNECTIVITY_LABELS, RISK_LABELS, type MonitoringFilters } from "@/features/thermal-monitoring/services/thermal-presentation";
import { COMPANY_PRIORITY_LABELS } from "@/features/thermal-priority/constants";

type Query = Record<string, string | undefined>;

function clean(query: Query): Record<string, string> {
  return Object.fromEntries(Object.entries(query).filter(([, v]) => !!v)) as Record<string, string>;
}

const QUICK_FILTERS: { key: keyof MonitoringFilters; value: string; label: string }[] = [
  { key: "risk", value: "CRITICAL", label: "Críticos" },
  { key: "connectivity", value: "OFFLINE", label: "Offline" },
  { key: "risk", value: "PENDING_AI", label: "Sem análise" },
  { key: "openIncident", value: "1", label: "Com incidente aberto" },
];

export function MonitoringQuickFilters({ filters }: { filters: MonitoringFilters }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Atalhos de filtro">
      {QUICK_FILTERS.map(({ key, value, label }) => {
        const active = filters[key] === value;
        const query = clean({ ...filters, [key]: active ? undefined : value });
        return (
          <Link
            key={`${key}-${value}`}
            href={{ pathname: "/thermal-monitoring", query }}
            aria-current={active ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground/75 hover:bg-muted"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function AppliedFilterChips({ filters, labels }: { filters: MonitoringFilters; labels: { sectors: Record<string, string>; equipments: Record<string, string>; panels: Record<string, string>; components: Record<string, string> } }) {
  const chips: { key: keyof MonitoringFilters; label: string }[] = [];
  if (filters.search) chips.push({ key: "search", label: `Busca: "${filters.search}"` });
  if (filters.risk) chips.push({ key: "risk", label: `Risco: ${filters.risk === "PENDING_AI" ? "Sem análise atual" : RISK_LABELS[filters.risk as keyof typeof RISK_LABELS]}` });
  if (filters.sectorId) chips.push({ key: "sectorId", label: `Setor: ${labels.sectors[filters.sectorId] ?? filters.sectorId}` });
  if (filters.connectivity) chips.push({ key: "connectivity", label: `Conectividade: ${CONNECTIVITY_LABELS[filters.connectivity as keyof typeof CONNECTIVITY_LABELS]}` });
  if (filters.equipmentId) chips.push({ key: "equipmentId", label: `Equipamento: ${labels.equipments[filters.equipmentId] ?? filters.equipmentId}` });
  if (filters.panelId) chips.push({ key: "panelId", label: `Painel: ${labels.panels[filters.panelId] ?? filters.panelId}` });
  if (filters.componentId) chips.push({ key: "componentId", label: `Componente: ${labels.components[filters.componentId] ?? filters.componentId}` });
  if (filters.companyPriority) chips.push({ key: "companyPriority", label: `Prioridade histórica: ${COMPANY_PRIORITY_LABELS[filters.companyPriority as keyof typeof COMPANY_PRIORITY_LABELS]}` });
  if (filters.openIncident) chips.push({ key: "openIncident", label: "Com incidente aberto" });

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={{ pathname: "/thermal-monitoring", query: clean({ ...filters, [chip.key]: undefined }) }}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground/80 hover:bg-muted/70"
        >
          {chip.label}
          <X className="h-3 w-3" aria-hidden="true" />
        </Link>
      ))}
      <Link href="/thermal-monitoring" className="text-xs font-medium text-primary underline">
        Limpar tudo
      </Link>
    </div>
  );
}
