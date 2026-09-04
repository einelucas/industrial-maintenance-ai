// Comando de backfill de leituras termográficas PENDING_AI (GPMS 2026 /
// Etapa 5). Uso:
//
//   pnpm thermal:backfill                 -- dry-run (só mostra a contagem elegível)
//   pnpm thermal:backfill -- --run        -- executa de verdade (respeita fail-closed)
//   pnpm thermal:backfill -- --run --batch-size=50 --max-batches=10
//
// Nunca roda automaticamente — precisa ser chamado explicitamente. Sem
// `--run`, é sempre dry-run (nunca chama o gateway de IA nem grava nada).
import { thermalBackfillService } from "../src/features/ai-core/services/thermal-backfill.service";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const run = process.argv.includes("--run");
  const batchSize = parseArg("batch-size");
  const maxBatches = parseArg("max-batches");

  const report = await thermalBackfillService.run({
    dryRun: !run,
    batchSize: batchSize ? Number(batchSize) : undefined,
    maxBatches: maxBatches ? Number(maxBatches) : undefined,
  });

  console.log(JSON.stringify(report, null, 2));

  if (!run) {
    console.log(
      "\nDry-run — nada foi processado. Rode com --run para processar de verdade (ainda assim, fail-closed: só faz algo se a IA térmica estiver pronta)."
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
