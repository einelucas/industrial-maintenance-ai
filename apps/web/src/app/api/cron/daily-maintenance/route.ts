import { NextResponse } from "next/server";
import { runDailyAutomation } from "@/features/automation/services/daily-automation.service";

export const maxDuration = 60;

/**
 * Único cron automático do deploy Vercel. Consolida o scheduler preventivo
 * e o processamento térmico para respeitar uma execução automática por dia.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const report = await runDailyAutomation();
  const status = report.status === "FAILED" ? 500 : report.status === "PARTIAL_FAILURE" ? 207 : 200;
  return NextResponse.json(report, { status });
}
