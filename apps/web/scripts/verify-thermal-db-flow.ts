/** Verifica uma inferência real e idempotente do TP-039 pelo fluxo operacional. */
import path from "node:path";

try {
  process.loadEnvFile(path.resolve(__dirname, "../.env"));
} catch {
  // Ambientes provisionados normalmente fornecem as variáveis pelo processo.
}
let closeDatabase: (() => Promise<void>) | undefined;

async function main() {
  const [{ prisma }, { inferenceRequestRepository }, { buildInferenceRequestId }, { thermalOrchestratorService }, { THERMAL_FEATURE_VERSION }] = await Promise.all([
    import("../src/lib/db/client"),
    import("../src/features/ai-core/repositories/inference-request.repository"),
    import("../src/features/ai-core/services/inference-request-id"),
    import("../src/features/ai-core/services/thermal-orchestrator.service"),
    import("../src/features/ai-core/temporal-features/calculate-temporal-features"),
  ]);
  closeDatabase = () => prisma.$disconnect();
  const reading = await prisma.thermalReading.findFirst({
    where: { thermalPoint: { code: "TP-039" } },
    orderBy: { measuredAt: "desc" },
    select: { id: true, thermalPointId: true, measuredAt: true, temperatureMaxC: true, referenceTemperatureC: true, deltaTC: true },
  });
  if (!reading) throw new Error("Nenhuma leitura do TP-039 foi encontrada.");
  const inferenceRequestId = buildInferenceRequestId(reading.id, THERMAL_FEATURE_VERSION);
  await inferenceRequestRepository.upsertPending({
    inferenceRequestId, thermalReadingId: reading.id,
    thermalPointId: reading.thermalPointId, featureVersion: THERMAL_FEATURE_VERSION,
  });
  const outcome = await thermalOrchestratorService.processInferenceRequest(inferenceRequestId);
  const request = await prisma.inferenceRequest.findUnique({
    where: { inferenceRequestId },
    include: { prediction: true },
  });
  if (request?.status !== "SUCCEEDED" || !request.prediction) {
    throw new Error(`Fluxo não concluiu: ${outcome.outcome} — ${outcome.reason ?? "sem motivo"}`);
  }
  console.log(JSON.stringify({
    reading: { ...reading, measuredAt: reading.measuredAt.toISOString() },
    outcome,
    prediction: {
      id: request.prediction.id, inferenceId: request.prediction.inferenceId,
      inferenceRequestId: request.prediction.inferenceRequestId,
      featureVersion: request.prediction.featureVersion,
      modelVersion: request.prediction.modelVersion,
      modelChecksum: request.prediction.modelChecksum,
      modelStage: request.prediction.modelStage,
      modelScore: request.prediction.modelScore,
      riskScore: request.prediction.riskScore,
      riskLevel: request.prediction.riskLevel,
    },
  }, null, 2));
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => { await closeDatabase?.(); });
