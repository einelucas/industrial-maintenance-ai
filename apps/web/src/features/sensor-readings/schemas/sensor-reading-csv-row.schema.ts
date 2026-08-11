import { z } from "zod";

// Number("") é 0, não NaN — sem isso, uma célula em branco do CSV viraria
// uma leitura real de "0" em vez de "sem valor" (diferença crítica para o
// modelo preditivo, que trata ausência de dado de forma diferente de zero).
const optionalNumber = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : value),
  z.coerce.number().optional()
);

// Uma linha do CSV de importação em lote (seção 39/escopo). O equipamento já
// é fixo pela página onde o upload acontece, então não há coluna de TAG.
export const sensorReadingCsvRowSchema = z.object({
  measuredAt: z.coerce.date({ invalid_type_error: "Data/hora da medição inválida." }),
  temperature: optionalNumber,
  vibration: optionalNumber,
  pressure: optionalNumber,
  rpm: optionalNumber,
  current: optionalNumber,
  torque: optionalNumber,
  operatingHours: optionalNumber,
});

export type SensorReadingCsvRow = z.infer<typeof sensorReadingCsvRowSchema>;

export type SensorReadingCsvImportResult = {
  imported: number;
  errors: { row: number; message: string }[];
};
