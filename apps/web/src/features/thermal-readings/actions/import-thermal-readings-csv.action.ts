"use server";

import { revalidatePath } from "next/cache";
import { csvImportService, type CsvImportReport } from "@/features/thermal-readings/services/csv-import.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

export type ImportThermalReadingsCsvFormState = {
  error?: string;
  report?: CsvImportReport;
};

export async function importThermalReadingsCsvAction(
  _prevState: ImportThermalReadingsCsvFormState,
  formData: FormData
): Promise<ImportThermalReadingsCsvFormState> {
  try {
    const user = await requirePermission("thermal-reading:import");

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Selecione um arquivo CSV." };
    }

    const text = await file.text();
    const report = await csvImportService.importFromText(text);

    // Auditoria registra só o resultado agregado — nunca o conteúdo bruto do
    // arquivo (poderia conter dado sensível de planta) nem qualquer
    // classificação analítica, que este fluxo nunca produz.
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "ThermalReading",
        entityId: "csv-import",
        action: "IMPORT",
        metadata: {
          fileName: file.name,
          totalRows: report.totalRows,
          acceptedCount: report.acceptedCount,
          rejectedCount: report.rejectedCount,
        },
      },
    });

    revalidatePath("/thermal-readings");
    return { report };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
