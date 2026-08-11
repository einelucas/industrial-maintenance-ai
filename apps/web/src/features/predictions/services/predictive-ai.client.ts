import "server-only";
import { IntegrationError } from "@/lib/errors";
import {
  predictiveAiResponseSchema,
  type PredictiveAiInput,
  type PredictiveAiResponse,
} from "@/features/predictions/schemas/predictive-ai.schema";
import { riskThresholdRepository } from "@/features/settings/repositories/risk-threshold.repository";

/**
 * Client centralizado para o serviço FastAPI de manutenção preditiva
 * (seção 36 do escopo). Nunca deve ser chamado diretamente por componentes
 * React — apenas por Server Actions/Services, mantendo o fluxo
 * Browser -> Next.js -> FastAPI (seção 37). A env AI_SERVICE_API_KEY nunca
 * é prefixada com NEXT_PUBLIC_, logo não chega ao bundle do client.
 */

const BASE_URL = process.env.PREDICTIVE_AI_URL ?? "http://localhost:8000";
const API_KEY = process.env.AI_SERVICE_API_KEY ?? "";
const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

export const predictiveAiClient = {
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/api/v1/health`, { method: "GET" });
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Nunca inventa uma prediction quando o serviço não responde (seção 38) —
   * lança IntegrationError, que a camada chamadora deve tratar exibindo que
   * o serviço preditivo está indisponível, sem derrubar a aplicação.
   */
  async predictFailure(input: PredictiveAiInput): Promise<PredictiveAiResponse> {
    // Faixas de risco configuráveis via UI (seção 23): buscadas do Postgres
    // e enviadas a cada chamada — o FastAPI não tem acesso a banco algum,
    // então não há outro jeito de repassar o override sem reiniciar o processo.
    const thresholds = await riskThresholdRepository.getOrCreateDefault().catch(() => null);

    let response: Response;
    try {
      response = await fetchWithTimeout(`${BASE_URL}/api/v1/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({
          equipmentId: input.equipmentId,
          temperature: input.temperature,
          vibration: input.vibration,
          pressure: input.pressure,
          rpm: input.rpm,
          current: input.current,
          torque: input.torque,
          operatingHours: input.operatingHours,
          airTemperature: input.airTemperature,
          processTemperature: input.processTemperature,
          toolWear: input.toolWear,
          rotationalSpeed: input.rotationalSpeed,
          thresholds: thresholds
            ? { lowMax: thresholds.lowMax, moderateMax: thresholds.moderateMax, highMax: thresholds.highMax }
            : undefined,
        }),
      });
    } catch (error) {
      throw new IntegrationError(
        "Serviço de manutenção preditiva indisponível no momento. Tente novamente mais tarde."
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new IntegrationError(
        `Serviço de manutenção preditiva retornou erro (${response.status}). ${body}`.trim()
      );
    }

    const json = await response.json();
    const parsed = predictiveAiResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new IntegrationError("Resposta inesperada do serviço de manutenção preditiva.");
    }

    return parsed.data;
  },
};
