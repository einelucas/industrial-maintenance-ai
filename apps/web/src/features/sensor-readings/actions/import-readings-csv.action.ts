"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { sensorReadingService } from "@/features/sensor-readings/services/sensor-reading.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import type { SensorReadingCsvImportResult } from "@/features/sensor-readings/schemas/sensor-reading-csv-row.schema";

export type CsvImportFormState = {
  error?: string;
  result?: SensorReadingCsvImportResult;
};

export async function importReadingsCsvAction(
  equipmentId: string,
  _prevState: CsvImportFormState,
  formData: FormData
): Promise<CsvImportFormState> {
  try {
    await requirePermission("equipment:manage");

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Selecione um arquivo CSV." };
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      return { error: `Erro ao ler o CSV: ${parsed.errors[0]!.message}` };
    }

    const result = await sensorReadingService.importCsv(equipmentId, parsed.data);
    revalidatePath(`/equipments/${equipmentId}`);
    return { result };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
