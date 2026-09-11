import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONNECTIVITY_LABELS, RISK_LABELS, type MonitoringFilters } from "@/features/thermal-monitoring/services/thermal-presentation";
import { COMPANY_PRIORITY_LABELS } from "@/features/thermal-priority/constants";

type Option = { id: string; name: string };
export function FilterSelect({ name, label, value, options }: { name: string; label: string; value?: string; options: Option[] }) {
  return <div className="space-y-1"><Label htmlFor={name}>{label}</Label><select id={name} name={name} defaultValue={value ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
    <option value="">Todos</option>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
  </select></div>;
}

// Campos sempre visíveis: busca, risco atual, setor, conectividade. Os
// demais (equipamento/painel/componente/prioridade histórica) ficam
// recolhidos em "Mais filtros" para não sobrecarregar a primeira dobra.
export function MonitoringFiltersForm({ filters, options }: { filters: MonitoringFilters; options: { sectors: Option[]; equipments: Option[]; panels: Option[]; components: Option[] } }) {
  const hasMoreFiltersApplied = Boolean(filters.equipmentId || filters.panelId || filters.componentId || filters.companyPriority);
  return <form action="/thermal-monitoring" className="space-y-3 rounded-lg border bg-card p-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-1"><Label htmlFor="search">Código ou nome do ponto</Label><Input id="search" name="search" defaultValue={filters.search} placeholder="Buscar ponto" /></div>
      <FilterSelect name="risk" label="Risco atual da IA" value={filters.risk} options={[...Object.entries(RISK_LABELS).map(([id, name]) => ({ id, name })), { id: "PENDING_AI", name: "Sem análise atual" }]} />
      <FilterSelect name="sectorId" label="Setor" value={filters.sectorId} options={options.sectors} />
      <FilterSelect name="connectivity" label="Conectividade" value={filters.connectivity} options={Object.entries(CONNECTIVITY_LABELS).map(([id, name]) => ({ id, name }))} />
    </div>
    <details open={hasMoreFiltersApplied} className="rounded-md border border-dashed p-3">
      <summary className="cursor-pointer text-sm font-medium text-primary">Mais filtros</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FilterSelect name="equipmentId" label="Equipamento" value={filters.equipmentId} options={options.equipments} />
        <FilterSelect name="panelId" label="Painel" value={filters.panelId} options={options.panels} />
        <FilterSelect name="componentId" label="Componente" value={filters.componentId} options={options.components} />
        <FilterSelect name="companyPriority" label="Prioridade histórica" value={filters.companyPriority} options={Object.entries(COMPANY_PRIORITY_LABELS).map(([id, name]) => ({ id, name }))} />
      </div>
    </details>
    {filters.openIncident && <input type="hidden" name="openIncident" value={filters.openIncident} />}
    <div className="flex items-center gap-2"><Button type="submit">Aplicar filtros</Button><Button variant="outline" asChild><Link href="/thermal-monitoring">Limpar</Link></Button></div>
  </form>;
}
