import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requirePermission } from "@/lib/auth/session";
import { reportsService } from "@/features/reports/services/reports.service";
import { MonthlySummaryDocument } from "@/features/reports/pdf/monthly-summary.pdf";
import { pdfResponse } from "@/features/reports/pdf-response";

export async function GET(request: Request) {
  await requirePermission("report:view");

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");

  const now = new Date();
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return Response.json({ error: "Parâmetros month/year inválidos." }, { status: 400 });
  }

  const monthDate = new Date(year, month - 1, 1);
  const { summary, byStatus, topEquipments, riskDistribution } = await reportsService.getMonthlySummaryReport(monthDate);
  const monthLabel = format(monthDate, "MMMM 'de' yyyy", { locale: ptBR });

  return pdfResponse(
    MonthlySummaryDocument({ monthLabel, summary, byStatus, topEquipments, riskDistribution }),
    `Resumo-mensal-${year}-${String(month).padStart(2, "0")}.pdf`
  );
}
