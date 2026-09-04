import { thermalAiGateway } from "@/features/ai-core/services/thermal-ai-gateway.service";
import { inferenceRequestRepository } from "@/features/ai-core/repositories/inference-request.repository";

// Fonte central única do estado da IA térmica (GPMS 2026 / Etapa 5) — nenhum
// outro service/action deve reimplementar esta lógica; todos que precisam
// bloquear operações analíticas quando a IA não está pronta chamam
// `aiCoreStateService.getState()`.

export type AiCoreStateStatus = "READY" | "DEGRADED" | "AI_CORE_UNAVAILABLE";

export interface AiCoreState {
  status: AiCoreStateStatus;
  reason?: string;
  modelStage?: string;
  modelVersion?: string;
  checkedAt: Date;
}

// Se a taxa de falha recente das tentativas de inferência ultrapassar isto,
// mesmo com o núcleo "pronto" segundo o health check, reportamos DEGRADED —
// sinal real (contagens de InferenceRequest), nunca estimado.
const DEGRADED_FAILURE_RATE_THRESHOLD = 0.5;
const DEGRADED_SAMPLE_WINDOW_MINUTES = 60;
const DEGRADED_MIN_SAMPLES = 3;
const DEGRADED_SAMPLE_LIMIT = 20;

export const aiCoreStateService = {
  async getState(): Promise<AiCoreState> {
    const checkedAt = new Date();
    const readiness = await thermalAiGateway.checkReadiness();

    if (!readiness.ready) {
      return { status: "AI_CORE_UNAVAILABLE", reason: readiness.reason, checkedAt };
    }

    const recent = await inferenceRequestRepository.recentAttempts(DEGRADED_SAMPLE_WINDOW_MINUTES, DEGRADED_SAMPLE_LIMIT);
    if (recent.length >= DEGRADED_MIN_SAMPLES) {
      const failed = recent.filter((r) => r.status === "FAILED").length;
      const failureRate = failed / recent.length;
      if (failureRate > DEGRADED_FAILURE_RATE_THRESHOLD) {
        return {
          status: "DEGRADED",
          reason: `Taxa de falha recente elevada (${failed}/${recent.length} tentativas na última hora).`,
          modelStage: readiness.modelStage,
          modelVersion: readiness.modelVersion,
          checkedAt,
        };
      }
    }

    return { status: "READY", modelStage: readiness.modelStage, modelVersion: readiness.modelVersion, checkedAt };
  },

  /** Atalho para os gates de ação: só READY autoriza operações analíticas. */
  async isReady(): Promise<boolean> {
    const state = await this.getState();
    return state.status === "READY";
  },
};
