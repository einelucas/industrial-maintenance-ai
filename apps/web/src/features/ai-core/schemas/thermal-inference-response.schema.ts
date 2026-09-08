import { z } from "zod";
import { ThermalCause } from "@prisma/client";

// Contrato de RESPOSTA do gateway de IA térmica (GPMS 2026 / Etapa 5) —
// validação estrita, fail-closed por padrão: qualquer desvio do formato
// (campo ausente, fora de faixa, estágio não permitido) é rejeitado inteiro,
// nunca "aceito parcialmente". `.strict()` também barra qualquer campo extra
// não previsto no contrato.

// Estágios aceitos para um modelo TÉRMICO operacional — deliberadamente um
// subconjunto fixo no código, não configurável por variável de ambiente
// (ver `EXPECTED_MODEL_STAGE` em `.env`, que só PINA um valor entre estes,
// nunca AMPLIA a lista). `RULE_ONLY`, `DEMO` e qualquer estágio desconhecido
// são sempre rejeitados, mesmo que uma variável de ambiente mal configurada
// tentasse permiti-los — não existe "flag de fallback" possível aqui.
export const ALLOWED_THERMAL_MODEL_STAGES = ["SYNTHETIC_EXPERIMENTAL", "PLANT_CALIBRATION", "PLANT_VALIDATED"] as const;
export type AllowedThermalModelStage = (typeof ALLOWED_THERMAL_MODEL_STAGES)[number];

const THERMAL_CAUSE_VALUES = Object.values(ThermalCause) as [ThermalCause, ...ThermalCause[]];

export const thermalInferenceResponseSchema = z
  .object({
    inferenceId: z.string().min(1, "inferenceId é obrigatório."),
    inferenceRequestId: z.string().min(1, "inferenceRequestId é obrigatório."),
    modelVersion: z.string().min(1, "modelVersion é obrigatório."),
    modelChecksum: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/i, "modelChecksum deve estar no formato sha256:<64 caracteres hexadecimais>."),
    modelStage: z.enum(ALLOWED_THERMAL_MODEL_STAGES, {
      errorMap: () => ({ message: "Estágio de modelo não permitido para operação (DEMO/RULE_ONLY/desconhecido são sempre rejeitados)." }),
    }),
    modelScore: z.number().min(0).max(100, "modelScore deve estar entre 0 e 100."),
    riskScore: z.number().min(0).max(100, "riskScore deve estar entre 0 e 100."),
    riskLevel: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]),
    confidence: z.number().min(0).max(1, "confidence deve estar entre 0 e 1."),
    predictedFailureMode: z.enum(THERMAL_CAUSE_VALUES),
    failureModeConfidence: z.number().min(0).max(1).nullable(),
    explanations: z.array(z.string().min(1)).min(1, "Ao menos uma explicação é obrigatória."),
    recommendedAction: z.string().min(1).nullable(),
  })
  .strict();

export type ThermalInferenceResponse = z.infer<typeof thermalInferenceResponseSchema>;

export const thermalReadinessResponseSchema = z
  .object({
    status: z.string().optional(),
    ready: z.boolean().optional(),
    modelLoaded: z.boolean().optional(),
    predictorType: z.string().optional(),
    modelStage: z.string().nullable().optional(),
    modelVersion: z.string().nullable().optional(),
    modelChecksum: z.string().regex(/^sha256:[a-f0-9]{64}$/i).nullable().optional(),
    isSyntheticModel: z.boolean().nullable().optional(),
    featureVersion: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
  })
  // `.passthrough()` mantém compatibilidade de leitura com o health geral;
  // readiness térmica ainda exige explicitamente todos os campos abaixo.
  .passthrough();

export type ThermalReadinessResponse = z.infer<typeof thermalReadinessResponseSchema>;
