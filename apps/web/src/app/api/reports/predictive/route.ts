import { requirePermission } from "@/lib/auth/session";

export async function GET() {
  await requirePermission("report:view");
  return Response.json({
    error: "THERMAL_REPORT_NOT_AVAILABLE",
    message: "Relatório preditivo mecânico desativado. Consulte as evidências em /thermal-monitoring; o relatório térmico será implementado na Etapa 10.",
  }, { status: 503 });
}
