/** Carregador explícito do cenário reservado da Etapa 7.
 *
 * Dry-run por padrão. Nunca lê/insere rótulos e nunca chama backfill/IA.
 * Escrita: --apply. Timestamps existentes: --allow-existing (são ignorados).
 * Pós-ação continua reservado: só entra com --include-post-action.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import { prisma } from "../src/lib/db/client";
import { thermalReadingService, type PreparedReadingRow } from "../src/features/thermal-readings/services/thermal-reading.service";

type Metadata = { artifacts?: Record<string, string>; reservedScenario?: { excludedFromDevelopment?: boolean } };
type RawRow = Record<string, string> & {
  timestamp: string;
  thermal_point_id: string;
  temperature_max_c: string;
  temperature_average_c: string;
  ambient_temperature_c: string;
  reference_temperature_c: string;
  current_a: string;
  load_percent: string;
  emissivity: string;
  signal_quality: string;
  communication_state: string;
};

const root = path.resolve(__dirname, "../../..");
const csvPath = path.join(root, "datasets/demo/reserved_plant_scenario.csv");
const metadataPath = path.join(root, "datasets/metadata/synthetic_thermal_generation.json");
const apply = process.argv.includes("--apply");
const allowExisting = process.argv.includes("--allow-existing");
const includePostAction = process.argv.includes("--include-post-action");

function hash(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function numberOrUndefined(value: string): number | undefined {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Valor numérico inválido no cenário: ${value}`);
  return parsed;
}

async function main() {
  const [csv, metadataRaw] = await Promise.all([readFile(csvPath, "utf8"), readFile(metadataPath, "utf8")]);
  const metadata = JSON.parse(metadataRaw) as Metadata;
  if (metadata.reservedScenario?.excludedFromDevelopment !== true) throw new Error("Manifesto não comprova isolamento do cenário reservado.");
  const expected = metadata.artifacts?.[path.basename(csvPath)];
  if (!expected || expected !== hash(csv)) throw new Error("Hash do cenário reservado diverge do manifesto.");
  const parsed = Papa.parse<RawRow>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`CSV reservado inválido: ${parsed.errors[0]?.message}`);
  const requiredColumns = ["timestamp", "thermal_point_id", "temperature_max_c", "communication_state"];
  if (!requiredColumns.every((column) => parsed.meta.fields?.includes(column))) {
    throw new Error(`CSV reservado não contém as colunas obrigatórias: ${requiredColumns.join(", ")}.`);
  }

  const peakRow = parsed.data.find((row) => row.thermal_point_id === "TP-039" && row.temperature_max_c === "75.6" && row.reference_temperature_c === "40.0");
  if (!peakRow) throw new Error("Pico reservado TP-039 não encontrado.");
  const peakAt = new Date(peakRow.timestamp);
  const selectedByPhase = includePostAction ? parsed.data : parsed.data.filter((row) => new Date(row.timestamp) <= peakAt);
  // OFFLINE representa ausência de leitura; nunca convertemos campo vazio em zero.
  const selected = selectedByPhase.filter((row) => row.communication_state !== "OFFLINE" && row.temperature_max_c !== "");
  const rows: PreparedReadingRow[] = selected.map((row, index) => ({
    rowNumber: index + 2,
    thermalPointCode: row.thermal_point_id,
    measuredAt: new Date(row.timestamp),
    temperatureMaxC: Number(row.temperature_max_c),
    temperatureAverageC: numberOrUndefined(row.temperature_average_c),
    ambientTemperatureC: numberOrUndefined(row.ambient_temperature_c),
    referenceTemperatureC: numberOrUndefined(row.reference_temperature_c),
    currentA: numberOrUndefined(row.current_a), loadPercent: numberOrUndefined(row.load_percent),
    emissivity: numberOrUndefined(row.emissivity), signalQuality: numberOrUndefined(row.signal_quality),
  }));
  // Nenhuma coluna de target/ground truth foi copiada para `rows`.
  const codes = [...new Set(rows.map((row) => row.thermalPointCode))];
  const firstAt = rows.reduce((min, row) => row.measuredAt < min ? row.measuredAt : min, rows[0]!.measuredAt);
  const lastAt = rows.reduce((max, row) => row.measuredAt > max ? row.measuredAt : max, rows[0]!.measuredAt);
  const existing = await prisma.thermalReading.findMany({
    where: { thermalPoint: { code: { in: codes } }, measuredAt: { gte: firstAt, lte: lastAt } },
    select: { measuredAt: true, thermalPoint: { select: { code: true } } },
  });
  const existingKeys = new Set(existing.map((row) => `${row.thermalPoint.code}|${row.measuredAt.toISOString()}`));
  const duplicateCount = rows.filter((row) => existingKeys.has(`${row.thermalPointCode}|${row.measuredAt.toISOString()}`)).length;
  if (duplicateCount && !allowExisting) {
    throw new Error(`${duplicateCount} timestamps já existem. Nenhuma escrita foi feita; use --allow-existing para ignorá-los explicitamente.`);
  }
  const pending = rows.filter((row) => !existingKeys.has(`${row.thermalPointCode}|${row.measuredAt.toISOString()}`));
  const report = { mode: apply ? "APPLY" : "DRY_RUN", source: "SIMULATOR", hash: expected, selectedRows: rows.length, offlineRowsSkipped: selectedByPhase.length - selected.length, duplicateCount, insertableRows: pending.length, includesPostAction: includePostAction, labelsCopied: false };
  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const result = await thermalReadingService.ingestBatchByCode(pending, "SIMULATOR");
  if (result.rejectedCount) throw new Error(`Carga parcialmente rejeitada (${result.rejectedCount}). Transação global não foi prometida; revise o relatório antes de repetir.`);
  console.log(JSON.stringify({ ...report, acceptedCount: result.acceptedCount }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
