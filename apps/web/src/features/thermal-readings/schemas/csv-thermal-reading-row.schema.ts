import { z } from "zod";
import { thermalReadingMeasurementSchema } from "./thermal-reading-measurement.schema";

// Linha de CSV (GPMS 2026 / Etapa 4) — o ponto é identificado por CÓDIGO
// (coluna "codigoPonto"), nunca por id interno: quem prepara a planilha não
// tem acesso ao id do banco. A resolução código -> id acontece no service,
// não aqui — este schema só garante que a coluna existe e não é vazia.
export const csvThermalReadingRowSchema = thermalReadingMeasurementSchema.and(
  z.object({
    thermalPointCode: z
      .string()
      .trim()
      .min(1, "Código do ponto é obrigatório.")
      .transform((v) => v.toUpperCase()),
  })
);

export type CsvThermalReadingRowInput = z.infer<typeof csvThermalReadingRowSchema>;

/** Cabeçalho documentado e obrigatório do CSV — nesta ordem ou fora dela, mas com estes nomes exatos. */
export const CSV_REQUIRED_COLUMNS = ["codigoPonto", "dataHoraMedicao", "temperaturaMaximaC"] as const;

export const CSV_OPTIONAL_COLUMNS = [
  "temperaturaMediaC",
  "temperaturaAmbienteC",
  "temperaturaReferenciaC",
  "correnteA",
  "cargaPercentual",
  "emissividade",
  "qualidadeSinal",
] as const;

export const CSV_ALL_COLUMNS = [...CSV_REQUIRED_COLUMNS, ...CSV_OPTIONAL_COLUMNS] as const;

/** Mapeia o nome da coluna do CSV para o campo aceito pelo schema de medição. */
export const CSV_COLUMN_TO_FIELD: Record<(typeof CSV_ALL_COLUMNS)[number], string> = {
  codigoPonto: "thermalPointCode",
  dataHoraMedicao: "measuredAt",
  temperaturaMaximaC: "temperatureMaxC",
  temperaturaMediaC: "temperatureAverageC",
  temperaturaAmbienteC: "ambientTemperatureC",
  temperaturaReferenciaC: "referenceTemperatureC",
  correnteA: "currentA",
  cargaPercentual: "loadPercent",
  emissividade: "emissivity",
  qualidadeSinal: "signalQuality",
};
