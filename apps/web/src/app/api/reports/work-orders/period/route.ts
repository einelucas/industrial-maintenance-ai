import { endOfDay, startOfDay } from "date-fns";
import { requirePermission } from "@/lib/auth/session";
import { reportsService } from "@/features/reports/services/reports.service";
import { OrdersByPeriodDocument } from "@/features/reports/pdf/orders-by-period.pdf";
import { pdfResponse } from "@/features/reports/pdf-response";

export async function GET(request: Request) {
  await requirePermission("report:view");

  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  if (!startParam || !endParam) {
    return Response.json({ error: "Informe os parâmetros start e end (YYYY-MM-DD)." }, { status: 400 });
  }

  const start = startOfDay(new Date(startParam));
  const end = endOfDay(new Date(endParam));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return Response.json({ error: "Datas inválidas." }, { status: 400 });
  }

  const data = await reportsService.getOrdersByPeriodReport(start, end);
  return pdfResponse(OrdersByPeriodDocument(data), "Ordens-por-periodo.pdf");
}
