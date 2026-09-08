import "server-only";
import { IntegrationError } from "@/lib/errors";
import type { PredictiveAiInput, PredictiveAiResponse } from "@/features/predictions/schemas/predictive-ai.schema";

/**
 * Client centralizado para o serviço FastAPI de manutenção preditiva
 * (seção 36 do escopo). Nunca deve ser chamado diretamente por componentes
 * React — apenas por Server Actions/Services, mantendo o fluxo
 * Browser -> Next.js -> FastAPI (seção 37). A env AI_SERVICE_API_KEY nunca
 * é prefixada com NEXT_PUBLIC_, logo não chega ao bundle do client.
 */

export const predictiveAiClient = {
  async healthCheck(): Promise<boolean> {
    return false;
  },

  /**
   * Nunca inventa uma prediction quando o serviço não responde (seção 38) —
   * lança IntegrationError, que a camada chamadora deve tratar exibindo que
   * o serviço preditivo está indisponível, sem derrubar a aplicação.
   */
  async predictFailure(input: PredictiveAiInput): Promise<PredictiveAiResponse> {
    void input;
    throw new IntegrationError("Fluxo mecânico legado desativado. Use a inferência térmica obrigatória.");
  },
};
