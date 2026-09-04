import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Testes de integração do domínio termográfico (GPMS 2026 / Etapa 1).
//
// Exercitam constraints reais do PostgreSQL (unicidade, foreign keys,
// onDelete) e por isso NÃO usam mocks. Precisam de um PostgreSQL
// descartável, isolado, referenciado por TEST_DATABASE_URL. Idealmente
// nunca o DATABASE_URL da aplicação — mas como este projeto às vezes não
// tem outro banco disponível, a limpeza abaixo é sempre escopada por id
// explicitamente rastreado nesta execução (nunca `deleteMany()` sem
// filtro): mesmo rodando por engano contra o banco real, esta suíte nunca
// apaga dado que não criou (em particular, nunca toca no cenário
// determinístico da Etapa 2). Exemplo de setup em banco de teste dedicado:
//
//   DATABASE_URL=$TEST_DATABASE_URL DIRECT_URL=$TEST_DATABASE_URL \
//     npx prisma migrate deploy
//
// Sem TEST_DATABASE_URL definida, a suíte inteira é pulada (não falha).
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("Domínio termográfico — integração PostgreSQL (Etapa 1)", () => {
  let prisma: PrismaClient;

  // Prefixo único por execução: evita colisão de campos globalmente únicos
  // (tag/code/serialNumber/number) se a suíte rodar mais de uma vez sobre o
  // mesmo banco.
  const runId = randomUUID().slice(0, 8);
  let seq = 0;
  const unique = (label: string) => `${label}-${runId}-${seq++}`;

  // Rastreio explícito de tudo que esta execução cria — a limpeza em
  // afterAll deleta só por estes ids, nunca por deleteMany() sem filtro.
  const createdIds = {
    thermalIncident: [] as string[],
    prediction: [] as string[],
    thermogram: [] as string[],
    thermalReading: [] as string[],
    sensorDevice: [] as string[],
    thermalPoint: [] as string[],
    monitoredComponent: [] as string[],
    electricalPanel: [] as string[],
    workOrder: [] as string[],
    equipment: [] as string[],
    sector: [] as string[],
    user: [] as string[],
  };

  let sectorId: string;
  let baseEquipmentId: string;
  let userId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL as string } } });

    const sector = await prisma.sector.create({ data: { name: unique("sector") } });
    sectorId = sector.id;
    createdIds.sector.push(sector.id);

    const equipment = await prisma.equipment.create({
      data: {
        tag: unique("equip"),
        name: "Equipamento de teste",
        category: "TESTE",
        sectorId,
      },
    });
    baseEquipmentId = equipment.id;
    createdIds.equipment.push(equipment.id);

    const user = await prisma.user.create({
      data: {
        name: "Usuário de teste",
        email: `${unique("user")}@example.test`,
        passwordHash: "hash",
        role: "TECHNICIAN",
      },
    });
    userId = user.id;
    createdIds.user.push(user.id);
  });

  afterAll(async () => {
    // Ordem segura para FKs Restrict: filhos antes dos pais. Cada deleteMany
    // é filtrado pelos ids que esta própria execução criou.
    await prisma.thermalIncident.deleteMany({ where: { id: { in: createdIds.thermalIncident } } });
    // Prediction depois de ThermalIncident: `triggerPredictionId` é Restrict
    // (Etapa 5) — um incidente ainda referenciando a predição bloquearia a
    // exclusão dela.
    await prisma.prediction.deleteMany({ where: { id: { in: createdIds.prediction } } });
    await prisma.thermogram.deleteMany({ where: { id: { in: createdIds.thermogram } } });
    await prisma.thermalReading.deleteMany({ where: { id: { in: createdIds.thermalReading } } });
    await prisma.sensorDevice.deleteMany({ where: { id: { in: createdIds.sensorDevice } } });
    await prisma.thermalPoint.deleteMany({ where: { id: { in: createdIds.thermalPoint } } });
    await prisma.monitoredComponent.deleteMany({ where: { id: { in: createdIds.monitoredComponent } } });
    await prisma.electricalPanel.deleteMany({ where: { id: { in: createdIds.electricalPanel } } });
    await prisma.workOrder.deleteMany({ where: { id: { in: createdIds.workOrder } } });
    await prisma.equipment.deleteMany({ where: { id: { in: createdIds.equipment } } });
    await prisma.sector.deleteMany({ where: { id: { in: createdIds.sector } } });
    await prisma.user.deleteMany({ where: { id: { in: createdIds.user } } });
    await prisma.$disconnect();
  });

  async function createPanel(overrides: Partial<Prisma.ElectricalPanelUncheckedCreateInput> = {}) {
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

  async function createComponent(panelId: string) {
    const component = await prisma.monitoredComponent.create({
      data: {
        tag: unique("component"),
        name: "Componente de teste",
        componentType: "CONTACTOR",
        panelId,
      },
    });
    createdIds.monitoredComponent.push(component.id);
    return component;
  }

  async function createThermalPoint(
    componentId: string,
    overrides: Partial<Prisma.ThermalPointUncheckedCreateInput> = {}
  ) {
    const point = await prisma.thermalPoint.create({
      data: {
        code: unique("TP"),
        name: "Ponto de teste",
        componentId,
        monitoringMode: "MANUAL",
        ...overrides,
      },
    });
    createdIds.thermalPoint.push(point.id);
    return point;
  }

  /**
   * Predição termográfica mínima válida (GPMS 2026 / Etapa 5) — só para
   * satisfazer `ThermalIncident.triggerPredictionId` (obrigatório e único)
   * nos testes abaixo que exercitam o modelo de incidente. Não passa pelo
   * gateway de IA nem por `thermalOrchestratorService`: é só uma fixture de
   * dado, igual às demais desta suíte.
   */
  async function createThermalPrediction(thermalPointId: string) {
    const prediction = await prisma.prediction.create({
      data: {
        failureProbability: 0.9,
        riskLevel: "CRITICAL",
        predictedClass: 1,
        modelVersion: unique("model-version"),
        inputSnapshot: {},
        featuresUsed: {},
        thermalPointId,
        riskScore: 96.4,
        confidence: 0.9,
      },
    });
    createdIds.prediction.push(prediction.id);
    return prediction;
  }

  it("cria painel associado somente a setor", async () => {
    const panel = await createPanel();

    expect(panel.sectorId).toBe(sectorId);
    expect(panel.equipmentId).toBeNull();
  });

  it("cria painel associado a setor e equipamento", async () => {
    const panel = await createPanel({ equipmentId: baseEquipmentId });

    expect(panel.sectorId).toBe(sectorId);
    expect(panel.equipmentId).toBe(baseEquipmentId);
  });

  it("cria componente vinculado ao painel", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);

    expect(component.panelId).toBe(panel.id);

    const panelWithComponents = await prisma.electricalPanel.findUniqueOrThrow({
      where: { id: panel.id },
      include: { components: true },
    });
    expect(panelWithComponents.components.map((c) => c.id)).toContain(component.id);
  });

  it("rejeita ThermalPoint.code duplicado globalmente, mesmo em componentes diferentes", async () => {
    const panelA = await createPanel();
    const componentA = await createComponent(panelA.id);
    const panelB = await createPanel();
    const componentB = await createComponent(panelB.id);

    const code = unique("TP-DUP");
    await createThermalPoint(componentA.id, { code });

    await expect(createThermalPoint(componentB.id, { code })).rejects.toThrow();
  });

  it("rejeita a mesma combinação sensorDeviceId + sequence", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    const point = await createThermalPoint(component.id);
    const device = await prisma.sensorDevice.create({
      data: {
        serialNumber: unique("dev"),
        name: "Sensor de teste",
        thermalPointId: point.id,
        apiKeyHash: "hash",
      },
    });
    createdIds.sensorDevice.push(device.id);

    const reading = await prisma.thermalReading.create({
      data: {
        thermalPointId: point.id,
        sensorDeviceId: device.id,
        measuredAt: new Date(),
        temperatureMaxC: 50,
        source: "POINT_SENSOR",
        sequence: BigInt(1001),
      },
    });
    createdIds.thermalReading.push(reading.id);

    await expect(
      prisma.thermalReading.create({
        data: {
          thermalPointId: point.id,
          sensorDeviceId: device.id,
          measuredAt: new Date(),
          temperatureMaxC: 51,
          source: "POINT_SENSOR",
          sequence: BigInt(1001),
        },
      })
    ).rejects.toThrow();
  });

  it("aceita a mesma sequence em dispositivos diferentes", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    const point = await createThermalPoint(component.id);
    const deviceA = await prisma.sensorDevice.create({
      data: { serialNumber: unique("dev"), name: "Sensor A", thermalPointId: point.id, apiKeyHash: "hash" },
    });
    createdIds.sensorDevice.push(deviceA.id);
    const deviceB = await prisma.sensorDevice.create({
      data: { serialNumber: unique("dev"), name: "Sensor B", thermalPointId: point.id, apiKeyHash: "hash" },
    });
    createdIds.sensorDevice.push(deviceB.id);

    const readingA = await prisma.thermalReading.create({
      data: {
        thermalPointId: point.id,
        sensorDeviceId: deviceA.id,
        measuredAt: new Date(),
        temperatureMaxC: 50,
        source: "POINT_SENSOR",
        sequence: BigInt(42),
      },
    });
    createdIds.thermalReading.push(readingA.id);
    const readingB = await prisma.thermalReading.create({
      data: {
        thermalPointId: point.id,
        sensorDeviceId: deviceB.id,
        measuredAt: new Date(),
        temperatureMaxC: 52,
        source: "POINT_SENSOR",
        sequence: BigInt(42),
      },
    });
    createdIds.thermalReading.push(readingB.id);

    expect(readingA.id).not.toBe(readingB.id);
  });

  it("cria incidente associado a um ponto, sempre com referência à Prediction que o originou", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    const point = await createThermalPoint(component.id);
    const prediction = await createThermalPrediction(point.id);

    const incident = await prisma.thermalIncident.create({
      data: {
        thermalPointId: point.id,
        severity: "CRITICAL",
        peakTemperatureC: 75.6,
        peakDeltaTC: 35.6,
        lastRiskScore: 96.4,
        triggerPredictionId: prediction.id,
      },
    });
    createdIds.thermalIncident.push(incident.id);

    expect(incident.thermalPointId).toBe(point.id);
    expect(incident.triggerPredictionId).toBe(prediction.id);
    // GPMS 2026 / Etapa 5: todo incidente nasce PENDING_HUMAN_REVIEW — o
    // ciclo de vida real não usa mais o legado OPEN.
    expect(incident.status).toBe("PENDING_HUMAN_REVIEW");
    expect(incident.cause).toBe("NOT_CONFIRMED");
  });

  it("rejeita duas ThermalIncident apontando para a mesma Prediction como gatilho (triggerPredictionId único)", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    const point = await createThermalPoint(component.id);
    const prediction = await createThermalPrediction(point.id);

    const first = await prisma.thermalIncident.create({
      data: { thermalPointId: point.id, severity: "CRITICAL", peakTemperatureC: 75.6, lastRiskScore: 96.4, triggerPredictionId: prediction.id },
    });
    createdIds.thermalIncident.push(first.id);

    await expect(
      prisma.thermalIncident.create({
        data: { thermalPointId: point.id, severity: "CRITICAL", peakTemperatureC: 75.6, lastRiskScore: 96.4, triggerPredictionId: prediction.id },
      })
    ).rejects.toThrow();
  });

  it("permite relação opcional 1:1 entre incidente e OS e rejeita reaproveitar a mesma OS em outro incidente", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    const pointA = await createThermalPoint(component.id);
    const pointB = await createThermalPoint(component.id);

    const workOrder = await prisma.workOrder.create({
      data: {
        number: unique("OS"),
        title: "OS preditiva de teste",
        type: "PREDICTIVE",
        equipmentId: baseEquipmentId,
        createdById: userId,
      },
    });
    createdIds.workOrder.push(workOrder.id);

    const predictionA = await createThermalPrediction(pointA.id);
    const predictionB = await createThermalPrediction(pointB.id);

    const incidentA = await prisma.thermalIncident.create({
      data: {
        thermalPointId: pointA.id,
        severity: "CRITICAL",
        peakTemperatureC: 75.6,
        lastRiskScore: 96.4,
        workOrderId: workOrder.id,
        triggerPredictionId: predictionA.id,
      },
    });
    createdIds.thermalIncident.push(incidentA.id);
    expect(incidentA.workOrderId).toBe(workOrder.id);

    await expect(
      prisma.thermalIncident.create({
        data: {
          thermalPointId: pointB.id,
          severity: "HIGH",
          peakTemperatureC: 60,
          lastRiskScore: 70,
          workOrderId: workOrder.id,
          triggerPredictionId: predictionB.id,
        },
      })
    ).rejects.toThrow();
  });

  it("bloqueia (Restrict) excluir um componente que ainda tem ThermalPoint", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    await createThermalPoint(component.id);

    await expect(prisma.monitoredComponent.delete({ where: { id: component.id } })).rejects.toThrow();
  });

  it("zera (SetNull) ElectricalPanel.equipmentId ao excluir o equipamento vinculado", async () => {
    const dedicatedEquipment = await prisma.equipment.create({
      data: { tag: unique("equip-setnull"), name: "Equip. SetNull", category: "TESTE", sectorId },
    });
    const panel = await createPanel({ equipmentId: dedicatedEquipment.id });

    await prisma.equipment.delete({ where: { id: dedicatedEquipment.id } });

    const reloaded = await prisma.electricalPanel.findUniqueOrThrow({ where: { id: panel.id } });
    expect(reloaded.equipmentId).toBeNull();
  });

  it("remove em cascata (Cascade) o Thermogram ao excluir a ThermalReading", async () => {
    const panel = await createPanel();
    const component = await createComponent(panel.id);
    const point = await createThermalPoint(component.id);
    const reading = await prisma.thermalReading.create({
      data: {
        thermalPointId: point.id,
        measuredAt: new Date(),
        temperatureMaxC: 75.6,
        source: "MANUAL",
      },
    });
    createdIds.thermalReading.push(reading.id);
    const thermogram = await prisma.thermogram.create({
      data: {
        thermalReadingId: reading.id,
        storageKey: unique("storage-key"),
        mimeType: "image/jpeg",
        capturedAt: new Date(),
      },
    });
    createdIds.thermogram.push(thermogram.id);

    await prisma.thermalReading.delete({ where: { id: reading.id } });
    // A leitura (e o termograma, em cascata) já foram removidos por este
    // teste — retirar da lista evita um deleteMany() redundante no afterAll.
    createdIds.thermalReading = createdIds.thermalReading.filter((id) => id !== reading.id);
    createdIds.thermogram = createdIds.thermogram.filter((id) => id !== thermogram.id);

    const reloadedThermogram = await prisma.thermogram.findUnique({ where: { id: thermogram.id } });
    expect(reloadedThermogram).toBeNull();
  });
});
