import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { thermalReadingRepository } from "@/features/thermal-readings/repositories/thermal-reading.repository";
import { thermalSettingsService } from "@/features/thermal-settings/services/thermal-settings.service";
import { inferenceRequestRepository } from "@/features/ai-core/repositories/inference-request.repository";
import { thermalAiGateway } from "@/features/ai-core/services/thermal-ai-gateway.service";
import { AiGatewayError, type AiGatewayFailureReason } from "@/features/ai-core/services/ai-gateway-error";
import { calculateTemporalFeatures, type TemporalFeatureReading } from "@/features/ai-core/temporal-features/calculate-temporal-features";
import type { ThermalInferenceRequest } from "@/features/ai-core/schemas/thermal-inference-request.schema";
import { thermalIncidentService } from "@/features/thermal-incidents/services/thermal-incident.service";

// Orquestrador único da cadeia AI-first (GPMS 2026 / Etapa 5):
//
//   ThermalReading -> features temporais -> gateway obrigatório da IA
//   -> resposta validada -> Prediction rastreável -> ThermalIncident
//
// É o ÚNICO lugar que chama `thermalAiGateway.predictThermal()` e o ÚNICO
// que cria `Prediction` termográfica. Nenhuma action ou formulário
// administrativo chama isto diretamente — só o backfill/worker (Etapa 5) e,
// no futuro, a fila de telemetria (Etapa 9).

const MAX_HISTORY_SAMPLES = 1000;
const MAX_ATTEMPTS = Number(process.env.AI_MAX_RETRIES ?? 5);

const TRANSIENT_REASONS: AiGatewayFailureReason[] = ["NOT_READY", "INSUFFICIENT_DATA", "NETWORK_ERROR", "TIMEOUT"];

export type ProcessInferenceOutcome = "SUCCEEDED" | "ALREADY_PROCESSED" | "TRANSIENT_FAILURE" | "FAILED";

export interface ProcessInferenceRequestResult {
  outcome: ProcessInferenceOutcome;
  reason?: string;
  predictionId?: string;
  incidentId?: string;
}

function toFeatureReading(r: { measuredAt: Date; temperatureMaxC: number; deltaTC: number | null; currentA: number | null; loadPercent: number | null; signalQuality: number | null }): TemporalFeatureReading {
  return {
    measuredAt: r.measuredAt,
    temperatureMaxC: r.temperatureMaxC,
    deltaTC: r.deltaTC,
    currentA: r.currentA,
    loadPercent: r.loadPercent,
    signalQuality: r.signalQuality,
  };
}

/** Round-trip por JSON garante um valor 100% compatível com `Prisma.InputJsonValue` (converte Date -> ISO string automaticamente, via Date.prototype.toJSON). */
function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

export const thermalOrchestratorService = {
  /**
   * Processa uma única `InferenceRequest` PENDING de ponta a ponta. Idempotente:
   * chamar de novo para uma requisição já SUCCEEDED/FAILED é um no-op seguro
   * (`ALREADY_PROCESSED`). Nunca cria Prediction/Incidente a partir de uma
   * resposta inválida — qualquer falha do gateway preserva a leitura como
   * `PENDING_AI` (falha transitória, ainda reprocessável) ou `AI_FAILED`
   * (falha definitiva, exige investigação).
   */
  async processInferenceRequest(inferenceRequestId: string): Promise<ProcessInferenceRequestResult> {
    const request = await prisma.inferenceRequest.findUnique({
      where: { inferenceRequestId },
      include: {
        thermalReading: true,
        thermalPoint: { include: { component: { include: { panel: true } } } },
      },
    });
    if (!request) throw new NotFoundError("InferenceRequest", inferenceRequestId);

    if (request.status !== "PENDING") {
      return { outcome: "ALREADY_PROCESSED", reason: `Requisição já está em status ${request.status}.` };
    }

    await inferenceRequestRepository.markAttemptStarted(request.id);

    const effectiveConfig = await thermalSettingsService.resolveForPoint(request.thermalPointId);
    const history = await thermalReadingRepository.findHistoryBefore(request.thermalPointId, request.thermalReading.measuredAt, MAX_HISTORY_SAMPLES);

    const features = calculateTemporalFeatures({
      current: toFeatureReading(request.thermalReading),
      priorReadings: history.map(toFeatureReading),
      attentionThresholdC: effectiveConfig.values.deltaTAttentionC,
    });

    const payload: ThermalInferenceRequest = {
      inferenceRequestId: request.inferenceRequestId,
      thermalReadingId: request.thermalReadingId,
      thermalPointId: request.thermalPointId,
      componentType: request.thermalPoint.component.componentType,
      featureVersion: features.featureVersion,
      current: {
        temperatureMaxC: request.thermalReading.temperatureMaxC,
        temperatureAverageC: request.thermalReading.temperatureAverageC,
        ambientTemperatureC: request.thermalReading.ambientTemperatureC,
        referenceTemperatureC: request.thermalReading.referenceTemperatureC,
        deltaTC: request.thermalReading.deltaTC,
        currentA: request.thermalReading.currentA,
        loadPercent: request.thermalReading.loadPercent,
        signalQuality: request.thermalReading.signalQuality,
        measuredAt: request.thermalReading.measuredAt.toISOString(),
      },
      window: {
        mean5mC: features.mean5mC.value,
        mean5mSampleCount: features.mean5mC.sampleCount,
        mean15mC: features.mean15mC.value,
        mean15mSampleCount: features.mean15mC.sampleCount,
        mean60mC: features.mean60mC.value,
        mean60mSampleCount: features.mean60mC.sampleCount,
        max1hC: features.max1hC.value,
        max6hC: features.max6hC.value,
        max24hC: features.max24hC.value,
        trendCPerHour: features.trendCPerHour,
        trendSampleCount: features.trendSampleCount,
        timeAboveLimitMin: features.timeAboveLimitMin,
        consecutiveAnomalousCount: features.consecutiveAnomalousCount,
        minutesSinceLastValidReading: features.minutesSinceLastValidReading,
      },
      baseline: {
        meanC: features.baseline.meanC,
        stdDevC: features.baseline.stdDevC,
        sampleCount: features.baseline.sampleCount,
        sufficient: features.baseline.sufficient,
        avgLoadPercent: features.avgLoadPercent,
        avgCurrentA: features.avgCurrentA,
      },
      thresholds: {
        absoluteLimitC: effectiveConfig.values.absoluteLimitC,
        attentionDeltaTC: effectiveConfig.values.deltaTAttentionC,
        highDeltaTC: effectiveConfig.values.deltaTHighC,
        criticalDeltaTC: effectiveConfig.values.deltaTCriticalC,
      },
      quality: {
        sufficientForInference: features.sufficientForInference,
        totalHistorySampleCount: features.totalHistorySampleCount,
        aggregatedSignalQuality: features.aggregatedSignalQuality,
      },
    };

    let response;
    try {
      response = await thermalAiGateway.predictThermal(payload);
    } catch (error) {
      if (!(error instanceof AiGatewayError)) throw error;

      const isTransient = TRANSIENT_REASONS.includes(error.reason);
      if (isTransient && request.attemptCount + 1 < MAX_ATTEMPTS) {
        // Permanece PENDING — o próximo lote de backfill/worker tenta de
        // novo. A leitura continua PENDING_AI (nunca vira "normal" por
        // omissão).
        return { outcome: "TRANSIENT_FAILURE", reason: error.message };
      }

      await inferenceRequestRepository.markFailed(request.id, error.reason, error.message);
      await prisma.thermalReading.update({ where: { id: request.thermalReadingId }, data: { analysisStatus: "AI_FAILED" } });
      return { outcome: "FAILED", reason: error.message };
    }

    // Persistência transacional: Prediction + ThermalReading.ANALYZED +
    // InferenceRequest.SUCCEEDED juntos, ou nenhum dos três.
    const { prediction, reading } = await prisma.$transaction(async (tx) => {
      const created = await tx.prediction.create({
        data: {
          failureProbability: response.riskScore / 100,
          riskLevel: response.riskLevel,
          predictedClass: response.riskLevel === "LOW" ? 0 : 1,
          modelVersion: response.modelVersion,
          inputSnapshot: toJsonValue(payload),
          featuresUsed: toJsonValue(features),
          thermalPointId: request.thermalPointId,
          thermalReadingId: request.thermalReadingId,
          riskScore: response.riskScore,
          confidence: response.confidence,
          modelStage: response.modelStage,
          modelScore: response.modelScore,
          trendCPerHour: features.trendCPerHour,
          timeAboveLimitMin: features.timeAboveLimitMin,
          explanations: toJsonValue(response.explanations),
          recommendedAction: response.recommendedAction,
          inferenceId: response.inferenceId,
          inferenceRequestId: response.inferenceRequestId,
          featureVersion: features.featureVersion,
          modelChecksum: response.modelChecksum,
          predictedFailureMode: response.predictedFailureMode,
          failureModeConfidence: response.failureModeConfidence,
        },
      });

      const updatedReading = await tx.thermalReading.update({
        where: { id: request.thermalReadingId },
        data: { analysisStatus: "ANALYZED" },
      });

      await tx.inferenceRequest.update({
        where: { id: request.id },
        data: { status: "SUCCEEDED", predictionId: created.id, lastErrorCode: null, lastErrorMessage: null },
      });

      return { prediction: created, reading: updatedReading };
    });

    try {
      const incident = await thermalIncidentService.evaluateAndUpsert(prediction, request.thermalPoint, reading.temperatureMaxC, reading.deltaTC);
      return { outcome: "SUCCEEDED", predictionId: prediction.id, incidentId: incident?.id };
    } catch (incidentError) {
      // A Prediction já está persistida com proveniência completa mesmo se
      // este passo falhar — nunca fica "Prediction sem proveniência" nem
      // "incidente parcial" (a falha aqui não deixa incidente pela metade,
      // porque `evaluateAndUpsert` só grava dentro da sua própria transação).
      return {
        outcome: "SUCCEEDED",
        predictionId: prediction.id,
        reason: `Predição registrada; consolidação de incidente falhou: ${(incidentError as Error).message}`,
      };
    }
  },
};
