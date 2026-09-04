// Taxonomia de falha do gateway de IA térmica (GPMS 2026 / Etapa 5) — cada
// motivo mapeia para um comportamento fail-closed específico no orquestrador
// (ex.: NOT_READY/NETWORK_ERROR/TIMEOUT mantêm a leitura PENDING_AI para
// retry; HTTP_ERROR/MALFORMED_RESPONSE/etc. marcam AI_FAILED). Nunca carrega
// a URL, a API key ou o corpo bruto da resposta — só uma mensagem já
// sanitizada.
export type AiGatewayFailureReason =
  | "NOT_READY"
  | "INSUFFICIENT_DATA"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "MALFORMED_RESPONSE"
  | "REQUEST_ID_MISMATCH"
  | "CHECKSUM_MISMATCH";

export class AiGatewayError extends Error {
  readonly reason: AiGatewayFailureReason;

  constructor(reason: AiGatewayFailureReason, message: string) {
    super(message);
    this.name = "AiGatewayError";
    this.reason = reason;
  }
}
