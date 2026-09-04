import { z } from "zod";
import { thermalReadingMeasurementSchema } from "./thermal-reading-measurement.schema";

// Registro manual (GPMS 2026 / Etapa 4) — o ponto é sempre identificado por
// id, porque a UI oferece um <select> com os pontos ativos reais do banco
// (nunca um código digitado livremente). "Manual" aqui descreve só a origem
// da MEDIÇÃO (foi um técnico que leu o valor, não um sensor) — nunca a
// origem de um diagnóstico, que este schema nem tem campos para carregar.
export const manualThermalReadingSchema = thermalReadingMeasurementSchema.and(
  z.object({
    thermalPointId: z.string().uuid("Selecione um ponto termográfico válido."),
  })
);

export type ManualThermalReadingInput = z.infer<typeof manualThermalReadingSchema>;
