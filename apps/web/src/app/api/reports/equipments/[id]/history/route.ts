import { requirePermission } from "@/lib/auth/session";
import { reportsService } from "@/features/reports/services/reports.service";
import { EquipmentHistoryDocument } from "@/features/reports/pdf/equipment-history.pdf";
import { pdfResponse } from "@/features/reports/pdf-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await requirePermission("report:view");
  const data = await reportsService.getEquipmentHistoryReport(params.id);
  return pdfResponse(EquipmentHistoryDocument(data), `Historico-${data.equipment.tag}.pdf`);
}
