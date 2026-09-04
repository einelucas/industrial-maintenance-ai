import { parseCsvReadings, CsvHeaderError } from "@/features/thermal-readings/services/csv-reading-parser";
import { thermalReadingService, type BatchIngestRejection } from "@/features/thermal-readings/services/thermal-reading.service";
import { ValidationError } from "@/lib/errors";

export interface CsvImportReport {
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  rejected: BatchIngestRejection[];
}

// Ponte entre o parser puro (`csv-reading-parser.ts`) e o service de
// ingestão compartilhado (`thermal-reading.service.ts`) — o único ponto
// deste arquivo que toca o banco é a chamada a `ingestBatchByCode`, a MESMA
// função usada pelo simulador. Nenhuma notificação/alerta é disparada aqui;
// a importação só marca `source = CSV` e deixa `analysisStatus` no padrão
// (`PENDING_AI`) — o backfill real pela IA fica para a Etapa 5+/8.
export const csvImportService = {
  async importFromText(rawText: string): Promise<CsvImportReport> {
    let parsed;
    try {
      parsed = parseCsvReadings(rawText);
    } catch (error) {
      if (error instanceof CsvHeaderError) throw new ValidationError(error.message);
      throw error;
    }

    const batchResult = await thermalReadingService.ingestBatchByCode(parsed.prepared, "CSV");

    const parseErrorRejections: BatchIngestRejection[] = parsed.parseErrors.map((e) => ({
      rowNumber: e.rowNumber,
      thermalPointCode: "",
      reason: e.reason,
    }));

    return {
      totalRows: parsed.totalDataRows,
      acceptedCount: batchResult.acceptedCount,
      rejectedCount: batchResult.rejectedCount + parseErrorRejections.length,
      rejected: [...parseErrorRejections, ...batchResult.rejected].sort((a, b) => (a.rowNumber ?? 0) - (b.rowNumber ?? 0)),
    };
  },
};
