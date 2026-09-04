import { z } from "zod";

// Decisão humana sobre o defeito indicado pela IA (GPMS 2026 / Etapa 5).
// Justificativa obrigatória para tudo que não seja uma confirmação simples —
// rejeitar, declarar inconclusivo ou pedir nova leitura sempre exige dizer
// por quê. O schema nunca aceita `modelScore`, checksum, versão ou qualquer
// campo de proveniência da IA — o humano decide sobre o incidente, nunca
// reescreve a inferência original.
export const HUMAN_REVIEW_DECISIONS = ["CONFIRMED", "REJECTED", "INCONCLUSIVE", "NEW_READING_REQUIRED"] as const;

export const humanReviewDecisionSchema = z
  .object({
    thermalIncidentId: z.string().uuid("Incidente térmico inválido."),
    decision: z.enum(HUMAN_REVIEW_DECISIONS, { errorMap: () => ({ message: "Selecione uma decisão válida." }) }),
    justification: z
      .string()
      .trim()
      .max(2000, "Justificativa muito longa (máximo 2000 caracteres).")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .superRefine((data, ctx) => {
    if (data.decision !== "CONFIRMED" && !data.justification) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["justification"],
        message: "Justificativa é obrigatória para rejeitar, declarar inconclusivo ou pedir nova leitura.",
      });
    }
  });

export type HumanReviewDecisionInput = z.infer<typeof humanReviewDecisionSchema>;
