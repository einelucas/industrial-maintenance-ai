import { endOfDay, startOfDay } from "date-fns";
import type { RiskLevel } from "@prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { reportsService } from "@/features/reports/services/reports.service";
import { PredictiveReportDocument } from "@/features/reports/pdf/predictive-report.pdf";
import { pdfResponse } from "@/features/reports/pdf-response";

const VALID_RISK_LEVELS: RiskLevel[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

export async function GET(request: Request) {
  await requirePermission("report:view");

  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const riskLevelParam = searchParams.get("riskLevel");
  if (!startParam || !endParam) {
    return Response.json({ error: "Informe os parâmetros start e end (YYYY-MM-DD)." }, { status: 400 });
  }

  const start = startOfDay(new Date(startParam));
  const end = endOfDay(new Date(endParam));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return Response.json({ error: "Datas inválidas." }, { status: 400 });
  }

  const riskLevel =
    riskLevelParam && VALID_RISK_LEVELS.includes(riskLevelParam as RiskLevel) ? (riskLevelParam as RiskLevel) : undefined;

  const data = await reportsService.getPredictiveReport(start, end, riskLevel);
  return pdfResponse(PredictiveReportDocument(data), "Relatorio-preditivo.pdf");
}
