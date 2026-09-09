import { z } from "zod";

const COMPONENT_TYPES = [
  "CIRCUIT_BREAKER",
  "CONTACTOR",
  "THERMAL_RELAY",
  "TERMINAL",
  "BUSBAR",
  "FUSE",
  "CABLE_CONNECTION",
  "POWER_SUPPLY",
  "DRIVE",
  "OTHER",
] as const;

function orderRefine<T extends { deltaTAttentionC?: number; deltaTHighC?: number; deltaTCriticalC?: number }>(
  data: T,
  ctx: z.RefinementCtx
) {
  const { deltaTAttentionC: a, deltaTHighC: h, deltaTCriticalC: c } = data;
  if (a !== undefined && h !== undefined && !(a < h)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deltaTHighC"], message: "O limite alto deve ser maior que o de atenção." });
  }
  if (h !== undefined && c !== undefined && !(h < c)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deltaTCriticalC"], message: "O limite crítico deve ser maior que o alto." });
  }
  if (a !== undefined && c !== undefined && h === undefined && !(a < c)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deltaTCriticalC"], message: "O limite crítico deve ser maior que o de atenção." });
  }
}

// Configuração global: os quatro limites são obrigatórios — é o piso de
// engenharia usado quando nenhum nível mais específico existir.
export const globalThermalConfigSchema = z
  .object({
    absoluteLimitC: z.coerce.number().finite().positive("Limite absoluto deve ser maior que zero."),
    deltaTAttentionC: z.coerce.number().finite().positive("Limite de atenção deve ser maior que zero."),
    deltaTHighC: z.coerce.number().finite().positive("Limite alto deve ser maior que zero."),
    deltaTCriticalC: z.coerce.number().finite().positive("Limite crítico deve ser maior que zero."),
  })
  .superRefine(orderRefine);

export type GlobalThermalConfigInput = z.infer<typeof globalThermalConfigSchema>;

const optionalPositiveNumber = (message: string) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().finite(message).positive(message).optional()
  );

// Override por tipo de componente: todos os limites são opcionais (só
// sobrescreve o que for informado; o resto continua caindo para o próximo
// nível da precedência).
export const componentTypeThermalConfigSchema = z
  .object({
    componentType: z.enum(COMPONENT_TYPES, { errorMap: () => ({ message: "Selecione um tipo de componente válido." }) }),
    absoluteLimitC: optionalPositiveNumber("Limite absoluto deve ser um número positivo."),
    deltaTAttentionC: optionalPositiveNumber("Limite de atenção deve ser um número positivo."),
    deltaTHighC: optionalPositiveNumber("Limite alto deve ser um número positivo."),
    deltaTCriticalC: optionalPositiveNumber("Limite crítico deve ser um número positivo."),
  })
  .superRefine(orderRefine);

export type ComponentTypeThermalConfigInput = z.infer<typeof componentTypeThermalConfigSchema>;
