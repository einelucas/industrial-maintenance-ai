import { ThermalReadingCsvImportForm } from "@/features/thermal-readings/components/thermal-reading-csv-import-form";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function ImportThermalReadingsPage() {
  await requirePermission("thermal-reading:import");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Leituras Termográficas", href: "/thermal-readings" },
            { label: "Importar CSV" },
          ]}
        />
        <h1 className="text-xl font-semibold">Importação de leituras via CSV</h1>
        <p className="text-sm text-muted-foreground">
          Um único arquivo pode alimentar vários pontos (resolvidos por código). O lote válido é persistido mesmo que algumas linhas
          sejam rejeitadas — o relatório abaixo mostra exatamente quais e por quê.
        </p>
      </div>
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ThermalReadingCsvImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
