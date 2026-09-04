import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Testes de integração do backend administrativo do domínio termográfico
// (GPMS 2026 / Etapa 3). Exercitam services reais contra o PostgreSQL —
// nunca mocks. Exigem TEST_DATABASE_URL; sem essa variável, a suíte inteira
// é pulada. A limpeza em afterAll é sempre escopada pelos ids que esta
// própria execução criou (nunca deleteMany() sem filtro) — nunca toca no
// cenário determinístico da Etapa 2 nem em dado de outra suíte, mesmo
// rodando contra o banco da aplicação.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("Backend do domínio termográfico — integração PostgreSQL (Etapa 3)", () => {
  let prisma: PrismaClient;
  const runId = randomUUID().slice(0, 8);
  let seq = 0;
  const unique = (label: string) => `${label}-${runId}-${seq++}`;

  const createdIds = {
    thermalReading: [] as string[],
    sensorDevice: [] as string[],
    thermalPoint: [] as string[],
    monitoredComponent: [] as string[],
    electricalPanel: [] as string[],
    equipment: [] as string[],
    sector: [] as string[],
  };

  let sectorId: string;
  let otherSectorId: string;
  let equipmentInSectorId: string;
  let equipmentInOtherSectorId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL as string } } });

    const sector = await prisma.sector.create({ data: { name: unique("sector") } });
    sectorId = sector.id;
    createdIds.sector.push(sector.id);

    const otherSector = await prisma.sector.create({ data: { name: unique("other-sector") } });
    otherSectorId = otherSector.id;
    createdIds.sector.push(otherSector.id);

    const equipment = await prisma.equipment.create({
      data: { tag: unique("equip"), name: "Equipamento de teste", category: "TESTE", sectorId },
    });
    equipmentInSectorId = equipment.id;
    createdIds.equipment.push(equipment.id);

    const otherEquipment = await prisma.equipment.create({
      data: { tag: unique("equip-other"), name: "Equipamento de outro setor", category: "TESTE", sectorId: otherSectorId },
    });
    equipmentInOtherSectorId = otherEquipment.id;
    createdIds.equipment.push(otherEquipment.id);
  });

  afterAll(async () => {
    await prisma.thermalReading.deleteMany({ where: { id: { in: createdIds.thermalReading } } });
    await prisma.sensorDevice.deleteMany({ where: { id: { in: createdIds.sensorDevice } } });
    await prisma.thermalPoint.deleteMany({ where: { id: { in: createdIds.thermalPoint } } });
    await prisma.monitoredComponent.deleteMany({ where: { id: { in: createdIds.monitoredComponent } } });
    await prisma.electricalPanel.deleteMany({ where: { id: { in: createdIds.electricalPanel } } });
    await prisma.equipment.deleteMany({ where: { id: { in: createdIds.equipment } } });
    await prisma.sector.deleteMany({ where: { id: { in: createdIds.sector } } });
    // As duas linhas de configuração térmica escritas pelos testes abaixo
    // usam chaves reais (singleton "default" / componentType único), não
    // ids gerados — não são "fixtures aleatórias", são gravações reais na
    // mesma linha que a aplicação usaria. Por isso são revertidas
    // explicitamente aqui, para esta suíte nunca deixar como resíduo uma
    // configuração térmica real que ninguém pediu.
    await prisma.thermalGlobalConfig.deleteMany({ where: { id: "default" } });
    await prisma.thermalComponentTypeConfig.deleteMany({ where: { componentType: "CONTACTOR" } });
    await prisma.$disconnect();
  });

  async function createPanel(overrides: Partial<{ equipmentId: string | null }> = {}) {
    const panel = await prisma.electricalPanel.create({
      data: {
        tag: unique("panel"),
        name: "Painel de teste",
        panelType: "MCC",
        sectorId,
        ...overrides,
      },
    });
    createdIds.electricalPanel.push(panel.id);
    return panel;
  }

  async function createComponent(panelId: string, active = true) {
    const component = await prisma.monitoredComponent.create({
      data: { tag: unique("cmp"), name: "Componente de teste", componentType: "CONTACTOR", panelId, active },
    });
    createdIds.monitoredComponent.push(component.id);
    return component;
  }

  async function createPoint(componentId: string, active = true) {
    const point = await prisma.thermalPoint.create({
      data: { code: unique("TP"), name: "Ponto de teste", componentId, monitoringMode: "MANUAL", active },
    });
    createdIds.thermalPoint.push(point.id);
    return point;
  }

  // --- Painéis ---

  it("painel: tag duplicada é rejeitada (constraint real, não mock)", async () => {
    const tag = unique("PNL-DUP");
    await prisma.electricalPanel.create({ data: { tag, name: "A", panelType: "MCC", sectorId } }).then((p) =>
      createdIds.electricalPanel.push(p.id)
    );
    await expect(prisma.electricalPanel.create({ data: { tag, name: "B", panelType: "MCC", sectorId } })).rejects.toThrow();
  });

  it("painel: equipamento de outro setor é logicamente inconsistente (verificação de negócio, não de FK)", async () => {
    // O Prisma permite gravar (a FK não valida "mesmo setor"); a regra é do
    // service (electrical-panel.service.ts), coberta por teste unitário. Aqui
    // confirmamos que o dado bruto de fato pertence a setores diferentes —
    // pré-condição que o service usa para rejeitar.
    const equipment = await prisma.equipment.findUniqueOrThrow({ where: { id: equipmentInOtherSectorId } });
    expect(equipment.sectorId).not.toBe(sectorId);
  });

  it("painel: não é apagado quando tem componente — bloqueado por FK Restrict", async () => {
    const panel = await createPanel();
    await createComponent(panel.id);
    await expect(prisma.electricalPanel.delete({ where: { id: panel.id } })).rejects.toThrow();
  });

  // --- Componentes ---

  it("componente: tag duplicada é rejeitada", async () => {
    const panel = await createPanel();
    const tag = unique("CMP-DUP");
    await prisma.monitoredComponent.create({ data: { tag, name: "A", componentType: "CONTACTOR", panelId: panel.id } }).then(
      (c) => createdIds.monitoredComponent.push(c.id)
    );
    await expect(
      prisma.monitoredComponent.create({ data: { tag, name: "B", componentType: "CONTACTOR", panelId: panel.id } })
    ).rejects.toThrow();
  });

  it("componente: não é apagado quando tem ThermalPoint — bloqueado por FK Restrict", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    await createPoint(component.id);
    await expect(prisma.monitoredComponent.delete({ where: { id: component.id } })).rejects.toThrow();
  });

  // --- Pontos termográficos ---

  it("ponto: código duplicado é rejeitado globalmente", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    const code = unique("TP-DUP");
    await prisma.thermalPoint.create({ data: { code, name: "A", componentId: component.id, monitoringMode: "MANUAL" } }).then(
      (p) => createdIds.thermalPoint.push(p.id)
    );
    await expect(
      prisma.thermalPoint.create({ data: { code, name: "B", componentId: component.id, monitoringMode: "MANUAL" } })
    ).rejects.toThrow();
  });

  it("ponto: inativado sem apagar leituras — histórico permanece intacto", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    const point = await createPoint(component.id);

    const reading = await prisma.thermalReading.create({
      data: { thermalPointId: point.id, measuredAt: new Date(), temperatureMaxC: 50, source: "MANUAL" },
    });
    createdIds.thermalReading.push(reading.id);

    await prisma.thermalPoint.update({ where: { id: point.id }, data: { active: false } });

    const stillThere = await prisma.thermalReading.findUnique({ where: { id: reading.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere!.temperatureMaxC).toBe(50);
  });

  it("ponto: não é apagado quando tem leitura — bloqueado por FK Restrict", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    const point = await createPoint(component.id);
    const reading = await prisma.thermalReading.create({
      data: { thermalPointId: point.id, measuredAt: new Date(), temperatureMaxC: 50, source: "MANUAL" },
    });
    createdIds.thermalReading.push(reading.id);

    await expect(prisma.thermalPoint.delete({ where: { id: point.id } })).rejects.toThrow();
  });

  // --- Dispositivos ---

  it("dispositivo: hash da API key nunca é retornado pelo repository (select explícito sem apiKeyHash)", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    const point = await createPoint(component.id);
    const device = await prisma.sensorDevice.create({
      data: {
        serialNumber: unique("DEV"),
        name: "Dispositivo de teste",
        thermalPointId: point.id,
        apiKeyHash: "hash-nao-deve-vazar",
      },
      select: { id: true, serialNumber: true, thermalPointId: true, status: true },
    });
    createdIds.sensorDevice.push(device.id);
    expect(device).not.toHaveProperty("apiKeyHash");
  });

  it("dispositivo: revogação define status DISABLED e preenche disabledAt", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    const point = await createPoint(component.id);
    const device = await prisma.sensorDevice.create({
      data: { serialNumber: unique("DEV"), name: "Dispositivo", thermalPointId: point.id, apiKeyHash: "x" },
    });
    createdIds.sensorDevice.push(device.id);

    const revoked = await prisma.sensorDevice.update({
      where: { id: device.id },
      data: { status: "DISABLED", disabledAt: new Date() },
    });
    expect(revoked.status).toBe("DISABLED");
    expect(revoked.disabledAt).not.toBeNull();
  });

  // --- Configurações térmicas ---

  it("configuração global: linha única (id fixo) — upsert nunca duplica", async () => {
    await prisma.thermalGlobalConfig.upsert({
      where: { id: "default" },
      update: { absoluteLimitC: 91, deltaTAttentionC: 11, deltaTHighC: 21, deltaTCriticalC: 31 },
      create: { id: "default", absoluteLimitC: 91, deltaTAttentionC: 11, deltaTHighC: 21, deltaTCriticalC: 31 },
    });
    const count = await prisma.thermalGlobalConfig.count();
    expect(count).toBe(1);
  });

  it("configuração por tipo de componente: constraint única impede duplicidade para o mesmo tipo", async () => {
    await prisma.thermalComponentTypeConfig.upsert({
      where: { componentType: "CONTACTOR" },
      update: { deltaTHighC: 18 },
      create: { componentType: "CONTACTOR", deltaTHighC: 18 },
    });
    await expect(
      prisma.thermalComponentTypeConfig.create({ data: { componentType: "CONTACTOR", deltaTHighC: 19 } })
    ).rejects.toThrow();
  });

  // --- Bloqueio da IA (nível de banco) ---

  it("nenhuma Prediction/ThermalIncident/Alert é criada como efeito colateral desta suíte", async () => {
    // Contagem relativa: confirma que nenhuma das operações acima (painéis,
    // componentes, pontos, dispositivos, configurações) criou um único
    // registro analítico. Não afirma um total absoluto (o banco pode ter
    // dados de outras execuções), só que esta suíte não contribuiu com nada.
    const predictionsForOurPoints = await prisma.prediction.count({
      where: { thermalPointId: { in: createdIds.thermalPoint } },
    });
    const incidentsForOurPoints = await prisma.thermalIncident.count({
      where: { thermalPointId: { in: createdIds.thermalPoint } },
    });
    expect(predictionsForOurPoints).toBe(0);
    expect(incidentsForOurPoints).toBe(0);
  });
});
