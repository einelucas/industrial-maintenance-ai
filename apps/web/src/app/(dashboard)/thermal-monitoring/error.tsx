"use client";
import { Button } from "@/components/ui/button";

export default function ThermalMonitoringError({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-3 rounded-lg border bg-card p-6"><h1 className="text-lg font-semibold">Não foi possível carregar os dados térmicos</h1><p className="text-sm text-muted-foreground">Verifique a conexão com os serviços e tente novamente. Nenhum estado de risco pode ser concluído enquanto os dados estiverem indisponíveis.</p><Button onClick={reset}>Tentar novamente</Button></div>;
}
