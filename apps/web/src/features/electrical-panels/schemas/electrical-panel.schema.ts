import { z } from "zod";

// Domínio termográfico (GPMS 2026 / Etapa 3). Aceita somente os campos
// administrativos do painel — nunca risco, severidade, diagnóstico ou
// qualquer campo de Prediction/incidente/alerta.
export const electricalPanelSchema = z.object({
  tag: z.string().min(2, "TAG é obrigatória.").max(50).trim().toUpperCase(),
  name: z.string().min(2, "Nome é obrigatório.").max(120).trim(),
  description: z.string().max(500).trim().optional().or(z.literal("")),
  location: z.string().max(120).trim().optional().or(z.literal("")),
  panelType: z.enum(["MCC", "DISTRIBUTION", "CONTROL", "PROTECTION", "OTHER"], {
    errorMap: () => ({ message: "Selecione um tipo de painel válido." }),
  }),
  sectorId: z.string().uuid("Selecione um setor válido."),
  equipmentId: z.string().uuid("Equipamento inválido.").optional().or(z.literal("")),
});

export type ElectricalPanelInput = z.infer<typeof electricalPanelSchema>;
