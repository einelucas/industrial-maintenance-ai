import { csvThermalReadingRowSchema, CSV_COLUMN_TO_FIELD, CSV_REQUIRED_COLUMNS } from "@/features/thermal-readings/schemas/csv-thermal-reading-row.schema";
import type { PreparedReadingRow } from "@/features/thermal-readings/services/thermal-reading.service";

// Parser puro do CSV de leituras termográficas (GPMS 2026 / Etapa 4) — sem
// I/O, sem Prisma. Recebe o texto bruto do arquivo e devolve linhas já
// validadas (`prepared`) e erros de parsing por linha (`parseErrors`); a
// resolução de código -> ponto e a persistência acontecem depois, em
// `csv-import.service.ts`, através do mesmo `thermalReadingService` usado
// pelo simulador.
//
// Cabeçalho documentado (nomes exatos, ordem livre):
//   Obrigatórias: codigoPonto, dataHoraMedicao, temperaturaMaximaC
//   Opcionais:    temperaturaMediaC, temperaturaAmbienteC, temperaturaReferenciaC,
//                 correnteA, cargaPercentual, emissividade, qualidadeSinal
// Separador: vírgula ou ponto e vírgula (detectado automaticamente pela
// linha de cabeçalho). Codificação: UTF-8, com ou sem BOM.

export interface CsvParseError {
  rowNumber: number;
  reason: string;
}

export interface CsvParseResult {
  totalDataRows: number;
  prepared: PreparedReadingRow[];
  parseErrors: CsvParseError[];
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(headerLine: string): "," | ";" {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

/** Split respeitando campos entre aspas duplas (permite valor contendo o próprio delimitador). */
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((v) => v.trim());
}

export class CsvHeaderError extends Error {
  constructor(missingColumns: string[]) {
    super(`Cabeçalho do CSV inválido. Colunas obrigatórias ausentes: ${missingColumns.join(", ")}.`);
  }
}

export function parseCsvReadings(rawText: string): CsvParseResult {
  const content = stripBom(rawText).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = content.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { totalDataRows: 0, prepared: [], parseErrors: [] };
  }

  const delimiter = detectDelimiter(lines[0]!);
  const headerCells = splitCsvLine(lines[0]!, delimiter);

  const missing = CSV_REQUIRED_COLUMNS.filter((col) => !headerCells.includes(col));
  if (missing.length > 0) {
    throw new CsvHeaderError(missing);
  }

  const prepared: PreparedReadingRow[] = [];
  const parseErrors: CsvParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1; // 1-based; a linha 1 é o cabeçalho
    const cells = splitCsvLine(lines[i]!, delimiter);

    const raw: Record<string, string> = {};
    headerCells.forEach((column, idx) => {
      const field = CSV_COLUMN_TO_FIELD[column as keyof typeof CSV_COLUMN_TO_FIELD];
      // Coluna vazia ausente na linha vira string vazia, nunca "0" — o schema
      // trata "" como campo ausente (ver thermal-reading-measurement.schema.ts).
      if (field) raw[field] = cells[idx] ?? "";
    });

    const result = csvThermalReadingRowSchema.safeParse(raw);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      parseErrors.push({ rowNumber, reason: firstIssue?.message ?? "Linha inválida." });
      continue;
    }

    prepared.push({
      rowNumber,
      thermalPointCode: result.data.thermalPointCode,
      measuredAt: result.data.measuredAt,
      temperatureMaxC: result.data.temperatureMaxC,
      temperatureAverageC: result.data.temperatureAverageC,
      ambientTemperatureC: result.data.ambientTemperatureC,
      referenceTemperatureC: result.data.referenceTemperatureC,
      currentA: result.data.currentA,
      loadPercent: result.data.loadPercent,
      emissivity: result.data.emissivity,
      signalQuality: result.data.signalQuality,
    });
  }

  return { totalDataRows: lines.length - 1, prepared, parseErrors };
}
