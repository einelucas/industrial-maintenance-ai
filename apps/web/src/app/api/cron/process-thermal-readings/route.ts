import { NextResponse } from "next/server";
import { thermalBackfillService } from "@/features/ai-core/services/thermal-backfill.service";

export const maxDuration = 60;

// Chamado pelo Vercel Cron (vercel.json) periodicamente. Não usa sessão de
// usuário (não há um humano logado durante o cron) — autenticado por
// segredo compartilhado em vez de `requirePermission`. Fail-closed: só
// processa se a IA térmica estiver com readiness válida (thermalBackfillService).
// O lote prioriza as leituras mais recentes, que representam o estado atual
// exibido no monitoramento; o histórico antigo é processado posteriormente.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const report = await thermalBackfillService.run({ dryRun: false });

  return NextResponse.json(report);
}
