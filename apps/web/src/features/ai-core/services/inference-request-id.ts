// Chave determinística de idempotência (GPMS 2026 / Etapa 5) — nunca gerada
// por `crypto.randomUUID()`/`Math.random()`. Duas chamadas para a mesma
// leitura e a mesma versão de features sempre produzem a mesma chave, então
// a constraint única de `InferenceRequest.inferenceRequestId` impede
// duplicação mesmo sob retry ou execução concorrente.
export function buildInferenceRequestId(thermalReadingId: string, featureVersion: string): string {
  return `${thermalReadingId}:${featureVersion}`;
}
