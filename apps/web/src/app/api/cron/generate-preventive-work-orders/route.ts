import { NextResponse } from "next/server";
import { maintenancePlanService } from "@/features/maintenance-plans/services/maintenance-plan.service";

// Chamado pelo Vercel Cron (vercel.json) uma vez por dia. Não usa sessão de
// usuário (não há um humano logado durante o cron) — autenticado por
// segredo compartilhado em vez de `requirePermission`.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const generated = await maintenancePlanService.runScheduledGeneration();

  return NextResponse.json({ generatedCount: generated.length, generated });
}
