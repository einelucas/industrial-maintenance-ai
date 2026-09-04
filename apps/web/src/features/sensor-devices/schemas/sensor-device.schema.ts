import { z } from "zod";

// Domínio termográfico (GPMS 2026 / Etapa 3). Provisionamento administrativo
// — nunca aceita `apiKeyHash`, `status`, `lastSeenAt` ou `lastSequence` do
// cliente (não existem no schema abaixo, logo são descartados na análise).
export const sensorDeviceProvisionSchema = z.object({
  serialNumber: z
    .string()
    .min(3, "Número de série é obrigatório.")
    .max(60)
    .trim()
    .toUpperCase()
    .refine((value) => !value.startsWith("SIM-"), {
      message: 'O prefixo "SIM-" é reservado para dispositivos virtuais do simulador (Etapa 2).',
    }),
  name: z.string().min(2, "Nome é obrigatório.").max(120).trim(),
  manufacturer: z.string().max(120).trim().optional().or(z.literal("")),
  model: z.string().max(120).trim().optional().or(z.literal("")),
  firmwareVersion: z.string().max(60).trim().optional().or(z.literal("")),
  thermalPointId: z.string().uuid("Selecione um ponto termográfico válido."),
});

export type SensorDeviceProvisionInput = z.infer<typeof sensorDeviceProvisionSchema>;
