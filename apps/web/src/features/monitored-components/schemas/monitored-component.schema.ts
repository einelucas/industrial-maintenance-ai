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

// Domínio termográfico (GPMS 2026 / Etapa 3). Aceita somente cadastro do
// componente — nunca risco, severidade, diagnóstico ou campos de Prediction.
export const monitoredComponentSchema = z.object({
  tag: z.string().min(2, "TAG é obrigatória.").max(50).trim().toUpperCase(),
  name: z.string().min(2, "Nome é obrigatório.").max(120).trim(),
  componentType: z.enum(COMPONENT_TYPES, { errorMap: () => ({ message: "Selecione um tipo de componente válido." }) }),
  phase: z.string().max(10).trim().optional().or(z.literal("")),
  ratedCurrent: z.coerce
    .number()
    .finite("Corrente nominal deve ser um número válido.")
    .positive("Corrente nominal deve ser maior que zero.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  manufacturer: z.string().max(120).trim().optional().or(z.literal("")),
  model: z.string().max(120).trim().optional().or(z.literal("")),
  panelId: z.string().uuid("Selecione um painel válido."),
});

export type MonitoredComponentInput = z.infer<typeof monitoredComponentSchema>;
