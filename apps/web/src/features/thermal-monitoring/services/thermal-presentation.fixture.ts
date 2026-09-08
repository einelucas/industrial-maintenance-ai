import type { TraceablePrediction } from "./thermal-presentation";

// Fixtures exclusivamente de teste, nunca importadas pelas telas ou persistidas.
export function predictionFixture(overrides: Partial<TraceablePrediction> = {}): TraceablePrediction {
  return {
    id: "prediction", equipmentId: "equipment", failureProbability: 0.95, riskLevel: "CRITICAL", predictedClass: 1,
    modelVersion: "thermal-test", inputSnapshot: {}, featuresUsed: {}, thermalPointId: "point", thermalReadingId: "reading",
    riskScore: 95, confidence: 0.9, modelStage: "SYNTHETIC_EXPERIMENTAL", ruleScore: null, modelScore: 93,
    trendCPerHour: 3, timeAboveLimitMin: 45, explanations: ["Tendência temporal persistente"], recommendedAction: "Inspecionar conexão",
    predictionHorizonH: null, inferenceId: "inference", inferenceRequestId: "request", featureVersion: "v1",
    modelChecksum: `sha256:${"a".repeat(64)}`, predictedFailureMode: "CONTACT_RESISTANCE", failureModeConfidence: 0.8,
    createdAt: new Date("2026-09-08T12:00:00Z"),
    thermalReading: { id: "reading", thermalPointId: "point", measuredAt: new Date("2026-09-08T11:59:00Z"), source: "SIMULATOR", analysisStatus: "ANALYZED" },
    inferenceRequest: { inferenceRequestId: "request", status: "SUCCEEDED", predictionId: "prediction", thermalReadingId: "reading", thermalPointId: "point", featureVersion: "v1" },
    ...overrides,
  };
}

