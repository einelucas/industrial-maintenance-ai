import { Skeleton } from "@/components/ui/skeleton";

export default function ThermalMonitoringLoading() {
  return <div role="status" aria-label="Carregando monitoramento térmico" className="space-y-6"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div><Skeleton className="h-40 w-full" /><div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div></div>;
}
