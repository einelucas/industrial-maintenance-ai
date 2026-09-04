import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { buildDemoScenario, buildReservedScenarioManifest, DEMO_IDENTITY_SEED, DEMO_SERIES_SEED } from "./scenario";

// Grava o cenário demonstrativo determinístico (Etapa 2 / GPMS 2026) no banco
// real, pelas mesmas tabelas/relações que a aplicação usa — nunca dados
// mockados. NÃO cria Prediction, ThermalIncident, Alert nem WorkOrder: esses
// registros só podem nascer de uma inferência real da IA e da decisão
// humana, em etapas futuras.
//
// Grava em lote (createMany + skipDuplicates) em vez de um upsert por
// registro: com ~290 registros estruturais + 6.600 leituras, um upsert por
// linha soma centenas de round-trips sequenciais contra o Neon remoto e
// arrisca estourar o tempo de vida da conexão do pooler (visto na prática:
// erro P1017 "Server has closed the connection" no meio de uma reexecução).
//
// IDs de Equipment/ElectricalPanel/MonitoredComponent/ThermalPoint/
// SensorDevice continuam com o `@default(uuid())` do schema (não são
// forçados) — assim uma reexecução sobre um banco já semeado por uma versão
// anterior deste seed continua encontrando as mesmas linhas pela chave de
// negócio (tag/código), em vez de tentar inserir um id previsível que não
// bateria com o uuid já gravado. Depois de cada `createMany`, os ids reais
// (recém-criados ou já existentes) são lidos de volta em uma única consulta
// em lote — poucos round-trips, sem inventar um esquema de id paralelo.
// `skipDuplicates` equivale a um upsert com `update: {}` aqui porque o
// cenário é 100% determinístico: uma reexecução calcula exatamente os
// mesmos valores, então "pular" e "atualizar sem mudar nada" chegam ao
// mesmo estado final. Sector é a única exceção: seu id já era determinístico
// (`demo-sector-<slug>`) desde a primeira versão do seed, então não há
// incompatibilidade a corrigir ali.

const __dirnameEsm = path.dirname(fileURLToPath(import.meta.url));
// apps/web/src/lib/thermal-simulation -> raiz do repositório (5 níveis).
const DEFAULT_MANIFEST_PATH = path.resolve(
  __dirnameEsm,
  "../../../../../datasets/demo/reserved_plant_manifest.json"
);

const READINGS_BATCH_SIZE = 1000;

export interface SeedThermalScenarioOptions {
  identitySeed?: number;
  seriesSeed?: number;
  /** Sobrescreve o destino do manifesto — usado pelos testes de integração. */
  manifestPath?: string;
}

export interface SeedThermalScenarioResult {
  sectors: number;
  equipments: number;
  panels: number;
  components: number;
  points: number;
  devices: number;
  readingsInserted: number;
  skippedExistingPoints: number;
  manifestPath: string;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Nunca armazena a chave em texto puro — apenas um hash determinístico do dispositivo virtual. */
function virtualDeviceApiKeyHash(pointCode: string): string {
  return createHash("sha256").update(`seed-virtual-device:${pointCode}`).digest("hex");
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const sectorIdOf = (name: string) => `demo-sector-${slug(name)}`;

export async function seedThermalScenario(
  prisma: PrismaClient,
  options: SeedThermalScenarioOptions = {}
): Promise<SeedThermalScenarioResult> {
  const identitySeed = options.identitySeed ?? DEMO_IDENTITY_SEED;
  const seriesSeed = options.seriesSeed ?? DEMO_SERIES_SEED;
  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST_PATH;

  const scenario = buildDemoScenario(identitySeed, seriesSeed);
  const { blueprint, seriesByPointCode } = scenario;

  await prisma.sector.createMany({
    data: blueprint.sectors.map((name) => ({
      id: sectorIdOf(name),
      name,
      description: `Setor de demonstração — ${name} (GPMS 2026, dado sintético).`,
    })),
    skipDuplicates: true,
  });

  await prisma.equipment.createMany({
    data: blueprint.equipments.map((eq) => ({
      tag: eq.tag,
      name: eq.name,
      category: eq.category,
      criticality: eq.criticality,
      status: "OPERATIONAL" as const,
      manufacturer: "Demonstração GPMS 2026",
      sectorId: sectorIdOf(eq.sector),
    })),
    skipDuplicates: true,
  });
  const equipmentRows = await prisma.equipment.findMany({
    where: { tag: { in: blueprint.equipments.map((eq) => eq.tag) } },
    select: { id: true, tag: true },
  });
  const equipmentIdByTag = new Map(equipmentRows.map((e) => [e.tag, e.id]));

  await prisma.electricalPanel.createMany({
    data: blueprint.panels.map((panel) => ({
      tag: panel.tag,
      name: panel.name,
      panelType: panel.panelType,
      sectorId: sectorIdOf(panel.sector),
      equipmentId: panel.equipmentTag ? equipmentIdByTag.get(panel.equipmentTag)! : null,
    })),
    skipDuplicates: true,
  });
  const panelRows = await prisma.electricalPanel.findMany({
    where: { tag: { in: blueprint.panels.map((p) => p.tag) } },
    select: { id: true, tag: true },
  });
  const panelIdByTag = new Map(panelRows.map((p) => [p.tag, p.id]));

  await prisma.monitoredComponent.createMany({
    data: blueprint.components.map((component) => ({
      tag: component.tag,
      name: component.name,
      componentType: component.componentType,
      ratedCurrent: component.ratedCurrent,
      panelId: panelIdByTag.get(component.panelTag)!,
    })),
    skipDuplicates: true,
  });
  const componentRows = await prisma.monitoredComponent.findMany({
    where: { tag: { in: blueprint.components.map((c) => c.tag) } },
    select: { id: true, tag: true },
  });
  const componentIdByTag = new Map(componentRows.map((c) => [c.tag, c.id]));

  await prisma.thermalPoint.createMany({
    data: blueprint.points.map((point) => ({
      code: point.code,
      name: point.name,
      componentId: componentIdByTag.get(point.componentTag)!,
      monitoringMode: "SIMULATOR" as const,
      referenceDescription: `Referência de comparação para ${point.code} (demonstração GPMS 2026).`,
      absoluteLimitC: point.absoluteLimitC,
      deltaTAttentionC: point.deltaTAttentionC,
      deltaTHighC: point.deltaTHighC,
      deltaTCriticalC: point.deltaTCriticalC,
      sampleIntervalSec: 300,
      initiallyAnomalous: point.initiallyAnomalous,
    })),
    skipDuplicates: true,
  });
  const pointRows = await prisma.thermalPoint.findMany({
    where: { code: { in: blueprint.points.map((p) => p.code) } },
    select: { id: true, code: true },
  });
  const pointIdByCode = new Map(pointRows.map((p) => [p.code, p.id]));

  await prisma.sensorDevice.createMany({
    data: blueprint.points.map((point) => {
      const series = seriesByPointCode.get(point.code)!;
      const firstReading = series.persisted[0]!;
      const lastReading = series.persisted[series.persisted.length - 1]!;
      return {
        serialNumber: `SIM-${point.code}`,
        name: `Dispositivo virtual — ${point.code}`,
        manufacturer: "Simulador GPMS 2026",
        model: "virtual-sim-v1",
        status: "ONLINE" as const,
        thermalPointId: pointIdByCode.get(point.code)!,
        apiKeyHash: virtualDeviceApiKeyHash(point.code),
        installedAt: firstReading.measuredAt,
        lastSeenAt: lastReading.measuredAt,
        lastSequence: BigInt(lastReading.sequence),
      };
    }),
    skipDuplicates: true,
  });
  const deviceRows = await prisma.sensorDevice.findMany({
    where: { serialNumber: { in: blueprint.points.map((p) => `SIM-${p.code}`) } },
    select: { id: true, serialNumber: true },
  });
  const deviceIdBySerial = new Map(deviceRows.map((d) => [d.serialNumber, d.id]));

  // Uma única consulta para saber quais pontos já têm histórico (idempotência),
  // em vez de uma contagem por ponto.
  const existingCounts = await prisma.thermalReading.groupBy({
    by: ["thermalPointId"],
    _count: { _all: true },
  });
  const pointsWithExistingReadings = new Set(existingCounts.map((r) => r.thermalPointId));

  let skippedExistingPoints = 0;
  const readingsToInsert: Array<{
    thermalPointId: string;
    sensorDeviceId: string;
    measuredAt: Date;
    receivedAt: Date;
    sequence: bigint;
    temperatureMaxC: number;
    temperatureAverageC: number;
    ambientTemperatureC: number;
    referenceTemperatureC: number;
    deltaTC: number;
    currentA: number;
    loadPercent: number;
    emissivity: number;
    signalQuality: number;
    source: "SIMULATOR";
  }> = [];

  for (const point of blueprint.points) {
    const thermalPointId = pointIdByCode.get(point.code)!;
    if (pointsWithExistingReadings.has(thermalPointId)) {
      skippedExistingPoints++;
      continue;
    }
    const series = seriesByPointCode.get(point.code)!;
    const sensorDeviceId = deviceIdBySerial.get(`SIM-${point.code}`)!;
    for (const r of series.persisted) {
      readingsToInsert.push({
        thermalPointId,
        sensorDeviceId,
        measuredAt: r.measuredAt,
        receivedAt: r.measuredAt,
        sequence: BigInt(r.sequence),
        temperatureMaxC: r.temperatureMaxC,
        temperatureAverageC: r.temperatureAverageC,
        ambientTemperatureC: r.ambientTemperatureC,
        referenceTemperatureC: r.referenceTemperatureC,
        deltaTC: r.deltaTC,
        currentA: r.currentA,
        loadPercent: r.loadPercent,
        emissivity: r.emissivity,
        signalQuality: r.signalQuality,
        source: "SIMULATOR",
      });
    }
  }

  let readingsInserted = 0;
  for (const batch of chunk(readingsToInsert, READINGS_BATCH_SIZE)) {
    const result = await prisma.thermalReading.createMany({ data: batch, skipDuplicates: true });
    readingsInserted += result.count;
  }

  const manifest = buildReservedScenarioManifest(scenario);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  return {
    sectors: blueprint.sectors.length,
    equipments: blueprint.equipments.length,
    panels: blueprint.panels.length,
    components: blueprint.components.length,
    points: blueprint.points.length,
    devices: blueprint.points.length,
    readingsInserted,
    skippedExistingPoints,
    manifestPath,
  };
}
