import { z } from "zod";

const MONITORING_MODES = ["MANUAL", "CSV", "SIMULATOR", "POINT_SENSOR", "THERMAL_ARRAY", "THERMAL_CAMERA"] as const;

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : value;

const optionalFiniteNumber = (message: string) =>
  z.preprocess(emptyToUndefined, z.coerce.number().finite(message).optional());

const optionalEmissivity = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number()
    .finite("Emissividade deve ser um número válido.")
    .gt(0, "Emissividade deve ser maior que zero.")
    .lte(1, "Emissividade deve ser no máximo 1.")
    .optional()
);

// Domínio termográfico (GPMS 2026 / Etapa 3) — AI-first. Este schema é a
// ÚNICA porta de entrada pública para cadastrar/editar um ThermalPoint e,
// por ser um objeto Zod sem `.passthrough()`, qualquer campo fora da lista
// abaixo é descartado silenciosamente na análise (não apenas ignorado no
// tipo). Isso garante estruturalmente que `initiallyAnomalous`, risco,
// severidade, score, diagnóstico, causa, decisão humana ou qualquer campo
// de Prediction nunca podem chegar ao banco por aqui — não existe "ignorar
// esse campo" a implementar, o campo simplesmente não existe no schema.
export const thermalPointSchema = z
  .object({
    code: z.string().min(2, "Código é obrigatório.").max(30).trim().toUpperCase(),
    name: z.string().min(2, "Nome é obrigatório.").max(120).trim(),
    componentId: z.string().uuid("Selecione um componente válido."),
    monitoringMode: z.enum(MONITORING_MODES, {
      errorMap: () => ({ message: "Selecione um modo de monitoramento válido." }),
    }),
    emissivity: optionalEmissivity,
    referenceDescription: z.string().max(300).trim().optional().or(z.literal("")),
    absoluteLimitC: optionalFiniteNumber("Limite absoluto deve ser um número válido."),
    deltaTAttentionC: optionalFiniteNumber("Limite de atenção (ΔT) deve ser um número válido."),
    deltaTHighC: optionalFiniteNumber("Limite alto (ΔT) deve ser um número válido."),
    deltaTCriticalC: optionalFiniteNumber("Limite crítico (ΔT) deve ser um número válido."),
    sampleIntervalSec: z.preprocess(
      (val) => (val === "" || val === undefined || val === null ? 60 : val),
      z.coerce
        .number()
        .int("Intervalo de amostragem deve ser um número inteiro.")
        .positive("Intervalo de amostragem deve ser maior que zero.")
    ),
  })
  .superRefine((data, ctx) => {
    // Ordem exigida: deltaTAttentionC < deltaTHighC < deltaTCriticalC —
    // validada apenas entre os valores efetivamente informados, sem exigir
    // que os três estejam presentes.
    const { deltaTAttentionC: a, deltaTHighC: h, deltaTCriticalC: c } = data;
    if (a !== undefined && h !== undefined && !(a < h)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deltaTHighC"],
        message: "O limite alto (ΔT) deve ser maior que o limite de atenção.",
      });
    }
    if (h !== undefined && c !== undefined && !(h < c)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deltaTCriticalC"],
        message: "O limite crítico (ΔT) deve ser maior que o limite alto.",
      });
    }
    if (a !== undefined && c !== undefined && h === undefined && !(a < c)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deltaTCriticalC"],
        message: "O limite crítico (ΔT) deve ser maior que o limite de atenção.",
      });
    }
  });

export type ThermalPointInput = z.infer<typeof thermalPointSchema>;
