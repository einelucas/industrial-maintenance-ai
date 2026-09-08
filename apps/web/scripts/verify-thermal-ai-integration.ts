/** Verificação HTTP real Next.js gateway -> FastAPI térmico, sem banco. */
import path from "node:path";

const root = path.resolve(__dirname, "../../..");
try {
  process.loadEnvFile(path.join(root, "services/predictive-ai/.env"));
} catch {
  // O valor padrão compartilhado continua válido quando não há .env local.
}
process.env.AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8000";

async function main() {
  const { thermalAiGateway } = await import("../src/features/ai-core/services/thermal-ai-gateway.service");
  const readiness = await thermalAiGateway.checkReadiness();
  if (!readiness.ready) throw new Error(readiness.reason ?? "FastAPI térmico não está ready.");
  const inferenceRequestId = "stage8-http-verification:thermal-features-v1";
  const result = await thermalAiGateway.predictThermal({
    inferenceRequestId,
    thermalReadingId: "11111111-1111-4111-8111-111111111111",
    thermalPointId: "22222222-2222-4222-8222-222222222222",
    componentType: "CIRCUIT_BREAKER",
    featureVersion: "thermal-features-v1",
    current: {
      temperatureMaxC: 75.6, temperatureAverageC: 74.2, ambientTemperatureC: 28,
      referenceTemperatureC: 40, deltaTC: 35.6, currentA: 30, loadPercent: 80,
      signalQuality: 0.95, measuredAt: "2026-09-03T18:00:00.000Z",
    },
    window: {
      mean5mC: 75.6, mean5mSampleCount: 1, mean15mC: 75.6, mean15mSampleCount: 1,
      mean60mC: 70, mean60mSampleCount: 2, max1hC: 75.6, max6hC: 75.6,
      max24hC: 75.6, trendCPerHour: 11.2, trendSampleCount: 2,
      timeAboveLimitMin: 60, consecutiveAnomalousCount: 3,
      minutesSinceLastValidReading: 30,
    },
    baseline: { meanC: 44, stdDevC: 3, sampleCount: 100, sufficient: true, avgLoadPercent: 68, avgCurrentA: 24 },
    thresholds: { absoluteLimitC: 70, attentionDeltaTC: 10, highDeltaTC: 20, criticalDeltaTC: 30 },
    quality: { sufficientForInference: true, totalHistorySampleCount: 100, aggregatedSignalQuality: 0.94 },
  });
  if (result.inferenceRequestId !== inferenceRequestId || result.riskLevel !== "CRITICAL") {
    throw new Error("Resposta térmica não preservou proveniência ou caso crítico.");
  }
  console.log(JSON.stringify({ readiness, prediction: {
    inferenceId: result.inferenceId, modelVersion: result.modelVersion,
    modelChecksum: result.modelChecksum, modelStage: result.modelStage,
    modelScore: result.modelScore, riskScore: result.riskScore,
    riskLevel: result.riskLevel, explanations: result.explanations.length,
  } }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
