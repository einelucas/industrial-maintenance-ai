import { requirePermission } from "@/lib/auth/session";
import { reportsService } from "@/features/reports/services/reports.service";
import { WorkOrderReportDocument } from "@/features/reports/pdf/work-order-report.pdf";
import { pdfResponse } from "@/features/reports/pdf-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await requirePermission("report:view");
  const workOrder = await reportsService.getWorkOrderReport(params.id);
  return pdfResponse(WorkOrderReportDocument({ workOrder }), `OS-${workOrder.number}.pdf`);
}
