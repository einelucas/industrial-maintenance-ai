import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { buildDemoScenario, buildReservedScenarioManifest, DEMO_IDENTITY_SEED, DEMO_SERIES_SEED } from "./scenario";
import {
  DEMO_PRIORITY_DEFINITIONS,
  DEMO_PRIORITY_POLICY_VERSION,
  DEMO_RISK_TO_COMPANY_PRIORITY,
} from "@/features/thermal-priority/services/thermal-priority-policy.service";
import {
  COMMERCIAL_SENSOR_PROFILES,
  selectCommercialSensorProfile,
} from "@/features/sensor-devices/catalog/commercial-sensor-catalog";
// Identificadores do seed demonstrativo determinístico — legado interno,
// nunca exposto na UI. Preservados como estão (não são "marca", são chaves
// de idempotência/autoconferência do próprio seed) para não quebrar a
// releitura de um banco de dev já semeado por uma versão anterior.
const LEGACY_DEMO_INSPECTION_REFERENCE = "GPMS2026-ORIGINAL-INSPECTION-DEMO-MAPPING-V1";
const LEGACY_DEMO_EXPECTED_DISTRIBUTION: Record<string, number> = {
  P5: 7,
  P10: 10,
  P20: 2,
  P30: 0,
  P50: 0,
  P100: 0,
};

// Grava o cenário demonstrativo determinístico (Etapa 2 / GPMS 2026) no banco
// real, pelas mesmas tabelas/relações que a aplicação usa — nunca dados
// mockados. NÃO cria Prediction, ThermalIncident, Alert nem WorkOrder: esses
// registros só podem nascer de uma inferência real da IA e da decisão
// humana, em etapas futuras.
//
// Grava em lote (createMany + skipDuplicates) em vez de um upsert por
// registro: com ~290 registros estruturais + 13.200 leituras, um upsert por
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
  inspections: number;
  inspectionFindings: number;
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
  const componentBlueprintByTag = new Map(blueprint.components.map((component) => [component.tag, component]));

  const referenceDeviceData = blueprint.points.map((point) => {
    const component = componentBlueprintByTag.get(point.componentTag);
    if (!component) throw new Error(`Componente ${point.componentTag} não encontrado para selecionar o sensor.`);
    const profile = selectCommercialSensorProfile({
      componentType: component.componentType,
      ratedCurrent: point.ratedCurrent,
    });

    return {
      point,
      profile,
      serialNumber: `SIM-${point.code}`,
      name: `Referência ${profile.model} — ${point.code}`,
    };
  });

  await prisma.sector.createMany({
    data: blueprint.sectors.map((name) => ({
      id: sectorIdOf(name),
      name,
      description: `Setor de demonstração — ${name} (dado sintético).`,
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
      manufacturer: "Fabricante demonstrativo (dado sintético)",
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
      referenceDescription: `Referência de comparação para ${point.code} (demonstração, dado sintético).`,
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
    data: referenceDeviceData.map(({ point, profile, serialNumber, name }) => {
      const series = seriesByPointCode.get(point.code)!;
      const firstReading = series.persisted[0]!;
      const lastReading = series.persisted[series.persisted.length - 1]!;
      return {
        serialNumber,
        name,
        manufacturer: profile.manufacturer,
        model: profile.model,
        firmwareVersion: profile.firmwareVersion,
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

  // Backfill seguro para bancos que ainda exibem "Dispositivo virtual".
  // Atualiza somente o inventário SIM-TP-* criado por este seed; número de
  // série, credencial, status e datas operacionais permanecem inalterados.
  for (const profile of Object.values(COMMERCIAL_SENSOR_PROFILES)) {
    const devices = referenceDeviceData.filter((device) => device.profile.id === profile.id);
    if (!devices.length) continue;
    await prisma.sensorDevice.updateMany({
      where: { serialNumber: { in: devices.map((device) => device.serialNumber) } },
      data: {
        name: `Referência ${profile.model}`,
        manufacturer: profile.manufacturer,
        model: profile.model,
        firmwareVersion: profile.firmwareVersion,
      },
    });
  }
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

  // Política demonstrativa versionada. P30/P50/P100 permanecem explicitamente
  // sem definição; a aplicação nunca cria significado para esses níveis.
  await prisma.thermalPriorityPolicy.createMany({
    data: [{
      version: DEMO_PRIORITY_POLICY_VERSION,
      status: "DEMO_DRAFT",
      definitions: JSON.parse(JSON.stringify(DEMO_PRIORITY_DEFINITIONS)),
      riskMapping: JSON.parse(JSON.stringify(DEMO_RISK_TO_COMPANY_PRIORITY)),
      validatedLevels: ["P5", "P10", "P20"],
      notes: "Mapeamento demonstrativo. P30, P50 e P100 aguardam definição oficial da empresa.",
    }],
    skipDuplicates: true,
  });

  // A fonte disponibilizada informa a distribuição e identifica o TP-039,
  // mas não traz a identidade do segundo P20. Por isso a inspeção registra
  // explicitamente que o segundo código é um mapeamento demonstrativo
  // determinístico, a ser reconciliado com o relatório oficial no piloto.
  let inspection = await prisma.thermalInspection.findUnique({
    where: { sourceReference: LEGACY_DEMO_INSPECTION_REFERENCE },
    include: { findings: true },
  });

  if (!inspection) {
    const anomalous = blueprint.points.filter((point) => point.initiallyAnomalous);
    const critical = anomalous.find((point) => point.isOfficialCriticalCase)!;
    const ordered = [critical, ...anomalous.filter((point) => !point.isOfficialCriticalCase).sort((a, b) => a.code.localeCompare(b.code))];
    const inspectedAt = seriesByPointCode.get(critical.code)!.persisted.at(-1)!.measuredAt;

    const findings = await Promise.all(ordered.map(async (point, index) => {
      const companyPriority: "P20" | "P10" | "P5" = index < 2 ? "P20" : index < 12 ? "P10" : "P5";
      const sourcePriorityLabel = companyPriority === "P20" ? "Prioridade 3" : companyPriority === "P10" ? "Prioridade 4" : "Prioridade 5";
      const series = seriesByPointCode.get(point.code)!;
      const originalReading = series.persisted.at(-1)!;
      const deviceId = deviceIdBySerial.get(`SIM-${point.code}`)!;
      const persistedReading = await prisma.thermalReading.findUnique({
        where: { sensorDeviceId_sequence: { sensorDeviceId: deviceId, sequence: BigInt(originalReading.sequence) } },
        select: { id: true },
      });
      return {
        thermalPointId: pointIdByCode.get(point.code)!,
        thermalReadingId: persistedReading?.id,
        sourcePriorityLabel,
        companyPriority,
        temperatureMaxC: originalReading.temperatureMaxC,
        referenceTemperatureC: originalReading.referenceTemperatureC,
        deltaTC: originalReading.deltaTC,
        recommendation: companyPriority === "P20"
          ? "Intervir em até 30 dias."
          : companyPriority === "P10"
            ? "Intervir em parada programada."
            : "Intensificar monitoramento.",
        observedCause: point.isOfficialCriticalCase ? "LOOSE_CONNECTION" as const : null,
        historicalBaseline: true,
      };
    }));

    await prisma.$transaction(async (tx) => {
      const createdInspection = await tx.thermalInspection.create({ data: {
        sourceReference: LEGACY_DEMO_INSPECTION_REFERENCE,
        inspectedAt,
        technicianName: "Inspeção demonstrativa (dado sintético)",
        notes: "Distribuição demonstrativa preservada. A identidade do segundo P20 é um mapeamento demonstrativo até reconciliação com uma inspeção real do cliente.",
        immutable: true,
      } });
      await tx.thermalInspectionFinding.createMany({
        data: findings.map((finding) => ({ ...finding, inspectionId: createdInspection.id })),
      });
    });

    inspection = await prisma.thermalInspection.findUnique({
      where: { sourceReference: LEGACY_DEMO_INSPECTION_REFERENCE },
      include: { findings: true },
    });
    if (!inspection) throw new Error("Falha ao persistir a inspeção original.");
  }

  const findingDistribution = inspection.findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.companyPriority] = (acc[finding.companyPriority] ?? 0) + 1;
    return acc;
  }, {});
  for (const [priority, expected] of Object.entries(LEGACY_DEMO_EXPECTED_DISTRIBUTION)) {
    if ((findingDistribution[priority] ?? 0) !== expected) {
      throw new Error(`Inspeção original inconsistente para ${priority}: esperado ${expected}, encontrado ${findingDistribution[priority] ?? 0}.`);
    }
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
    inspections: 1,
    inspectionFindings: inspection.findings.length,
    manifestPath,
  };
}
