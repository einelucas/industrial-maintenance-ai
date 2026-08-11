import { requirePermission } from "@/lib/auth/session";
import { reportsService } from "@/features/reports/services/reports.service";
import { OverdueOrdersDocument } from "@/features/reports/pdf/overdue-orders.pdf";
import { pdfResponse } from "@/features/reports/pdf-response";

export async function GET() {
  await requirePermission("report:view");
  const data = await reportsService.getOverdueOrdersReport();
  return pdfResponse(OverdueOrdersDocument(data), "Ordens-atrasadas.pdf");
}
