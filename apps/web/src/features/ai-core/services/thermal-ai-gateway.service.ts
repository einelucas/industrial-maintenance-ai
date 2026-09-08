import {
  thermalInferenceRequestSchema,
  type ThermalInferenceRequest,
} from "@/features/ai-core/schemas/thermal-inference-request.schema";
import {
  ALLOWED_THERMAL_MODEL_STAGES,
  thermalInferenceResponseSchema,
  thermalReadinessResponseSchema,
  type AllowedThermalModelStage,
  type ThermalInferenceResponse,
} from "@/features/ai-core/schemas/thermal-inference-response.schema";
import { AiGatewayError } from "@/features/ai-core/services/ai-gateway-error";
import { THERMAL_FEATURE_VERSION } from "@/features/ai-core/temporal-features/calculate-temporal-features";

// Único gateway de IA térmica (GPMS 2026 / Etapa 5) — nenhum service de
// leitura, incidente ou alerta deve chamar `fetch` diretamente para o
// FastAPI. Espelha o padrão já usado por `predictive-ai.client.ts`
// (mecânico/Etapa 0), mas com validação estrita e recusa fail-closed em toda
// falha, timeout, estágio não permitido ou resposta malformada — nunca
// inventa um resultado substituto.
//
// Deliberadamente SEM `import "server-only"` (diferente de
// `predictive-ai.client.ts`): este gateway também é chamado pelo comando de
// backfill (`scripts/thermal-backfill.ts`), executado fora do bundler do
// Next.js via `tsx` — onde o pacote `server-only` não existe como módulo
// real e quebraria a importação. A mesma garantia (nunca chamado do
// browser) já vem da convenção do projeto: nenhum Client Component importa
// services de `features/*/services`.
//
// O FastAPI da Etapa 8 só fica pronto com bundle e metadados térmicos válidos.

const BASE_URL = process.env.AI_SERVICE_URL ?? process.env.PREDICTIVE_AI_URL ?? "http://localhost:8000";
const API_KEY = process.env.AI_SERVICE_API_KEY ?? "";
const TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 8000);
// Pinagem OPCIONAL — quando configuradas, restringem ainda mais o conjunto
// já fixo em código (`ALLOWED_THERMAL_MODEL_STAGES`); nunca o ampliam. Uma
// variável de ambiente mal configurada não consegue, sozinha, habilitar
// DEMO/RULE_ONLY nem burlar a validação do schema de resposta.
const EXPECTED_MODEL_STAGE = process.env.EXPECTED_MODEL_STAGE || undefined;
const EXPECTED_MODEL_CHECKSUM = process.env.EXPECTED_MODEL_CHECKSUM || undefined;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

export interface ReadinessResult {
  ready: boolean;
  /** Mensagem já sanitizada — nunca contém URL, API key ou corpo bruto da resposta. */
  reason?: string;
  modelStage?: AllowedThermalModelStage;
  modelVersion?: string;
}

function isAllowedStage(stage: string | null | undefined): stage is AllowedThermalModelStage {
  return !!stage && (ALLOWED_THERMAL_MODEL_STAGES as readonly string[]).includes(stage);
}

export const thermalAiGateway = {
  /**
   * Única fonte de verdade sobre se a IA térmica está pronta. Uma resposta
   * HTTP 200 nunca basta sozinha — exige predictor térmico real, modelo
   * carregado e estágio permitido (e, se configurado, versão/checksum
   * pinados batendo exatamente).
   */
  async checkReadiness(): Promise<ReadinessResult> {
    let response: Response;
    try {
      response = await fetchWithTimeout(`${BASE_URL}/api/v1/thermal/health`, { method: "GET" });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      return { ready: false, reason: timedOut ? "Health check do núcleo de IA térmica expirou (timeout)." : "Núcleo de IA térmica indisponível (erro de rede)." };
    }

    if (!response.ok) {
      return { ready: false, reason: `Health check do núcleo de IA térmica retornou HTTP ${response.status}.` };
    }

    const json = await response.json().catch(() => null);
    const parsed = thermalReadinessResponseSchema.safeParse(json);
    if (!parsed.success) {
      return { ready: false, reason: "Resposta de health check em formato inesperado." };
    }

    const data = parsed.data;
    if (data.predictorType !== "thermal") {
      return { ready: false, reason: `Preditor ativo ("${data.predictorType ?? "ausente"}") não é um modelo térmico real.` };
    }
    if (data.ready !== true) {
      return { ready: false, reason: data.reason ?? "Núcleo de IA térmica não declarou readiness." };
    }
    if (!data.modelLoaded) {
      return { ready: false, reason: "Nenhum modelo térmico carregado." };
    }
    if (!data.modelChecksum) {
      return { ready: false, reason: "Checksum do modelo térmico ausente." };
    }
    if (data.featureVersion !== THERMAL_FEATURE_VERSION) {
      return { ready: false, reason: "Versão de features do modelo térmico incompatível." };
    }
    if (data.modelStage === "SYNTHETIC_EXPERIMENTAL" && data.isSyntheticModel !== true) {
      return { ready: false, reason: "Origem sintética do modelo experimental não foi declarada." };
    }
    if (!isAllowedStage(data.modelStage)) {
      return { ready: false, reason: `Estágio de modelo "${data.modelStage ?? "ausente"}" não é permitido para operação.` };
    }
    if (EXPECTED_MODEL_STAGE && data.modelStage !== EXPECTED_MODEL_STAGE) {
      return { ready: false, reason: "Estágio do modelo não corresponde ao estágio esperado configurado." };
    }
    if (EXPECTED_MODEL_CHECKSUM && data.modelChecksum !== EXPECTED_MODEL_CHECKSUM) {
      return { ready: false, reason: "Checksum do modelo não corresponde ao checksum esperado configurado." };
    }

    return { ready: true, modelStage: data.modelStage, modelVersion: data.modelVersion ?? undefined };
  },

  /**
   * Solicita uma inferência térmica. Lança `AiGatewayError` para toda falha
   * — nunca devolve um resultado parcial ou inventado. O chamador
   * (orquestrador) decide o que fazer com cada `reason` (normalmente:
   * preservar a leitura como PENDING_AI/AI_FAILED, nunca criar Prediction).
   */
  async predictThermal(request: ThermalInferenceRequest): Promise<ThermalInferenceResponse> {
    const readiness = await this.checkReadiness();
    if (!readiness.ready) {
      throw new AiGatewayError("NOT_READY", readiness.reason ?? "Núcleo de IA térmica indisponível.");
    }

    if (!request.quality.sufficientForInference) {
      throw new AiGatewayError("INSUFFICIENT_DATA", "Dados temporais insuficientes para uma inferência confiável (tendência ou baseline indisponíveis).");
    }

    // Defesa em profundidade: revalida a requisição contra o próprio
    // contrato estrito antes de enviar — se o orquestrador tentasse incluir
    // qualquer campo fora do contrato, a validação falha aqui, antes de
    // qualquer chamada de rede.
    const validatedRequest = thermalInferenceRequestSchema.parse(request);

    let response: Response;
    try {
      response = await fetchWithTimeout(`${BASE_URL}/api/v1/thermal/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify(validatedRequest),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      throw new AiGatewayError(
        timedOut ? "TIMEOUT" : "NETWORK_ERROR",
        timedOut ? "Requisição de inferência térmica expirou (timeout)." : "Serviço de IA térmica indisponível (erro de rede)."
      );
    }

    if (!response.ok) {
      throw new AiGatewayError("HTTP_ERROR", `Serviço de IA térmica retornou erro HTTP ${response.status}.`);
    }

    const json = await response.json().catch(() => null);
    const parsed = thermalInferenceResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new AiGatewayError("MALFORMED_RESPONSE", "Resposta do serviço de IA térmica não corresponde ao contrato esperado.");
    }

    const data = parsed.data;
    if (data.inferenceRequestId !== validatedRequest.inferenceRequestId) {
      throw new AiGatewayError("REQUEST_ID_MISMATCH", "inferenceRequestId da resposta não corresponde ao da requisição.");
    }
    if (EXPECTED_MODEL_CHECKSUM && data.modelChecksum !== EXPECTED_MODEL_CHECKSUM) {
      throw new AiGatewayError("CHECKSUM_MISMATCH", "Checksum do modelo na resposta não corresponde ao checksum esperado configurado.");
    }

    return data;
  },
};
