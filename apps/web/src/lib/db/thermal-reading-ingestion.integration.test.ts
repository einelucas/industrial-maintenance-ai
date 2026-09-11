import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { thermalReadingService } from "@/features/thermal-readings/services/thermal-reading.service";

// Testes de integração da ingestão de leituras termográficas (GPMS 2026 /
// Etapa 4) — exercitam o service real (`thermalReadingService`) contra o
// PostgreSQL de verdade, nunca mocks. Exigem TEST_DATABASE_URL; sem essa
// variável, a suíte inteira é pulada.
//
// Regra de segurança de banco (reforçada após o incidente relatado no
// Markdown de adequações, em que um `afterAll` com `deleteMany()` sem filtro
// apagou o cenário termográfico real): esta suíte só cria registros próprios
// (setor/equipamento/painel/componente/ponto de teste, prefixados e com
// runId aleatório) e só apaga, no `afterAll`, exatamente os ids que ela
// mesma criou. Nunca varre a tabela inteira, nunca usa `deleteMany()` sem
// `where: { id: { in: [...] } }`, nunca roda `prisma migrate reset`, e nunca
// toca no cenário determinístico da Etapa 2 (13.200 leituras / 55 pontos) nem
// nos dados de outra suíte.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("Ingestão de leituras termográficas — integração PostgreSQL (Etapa 4)", () => {
  let prisma: PrismaClient;
  const runId = randomUUID().slice(0, 8);
  let seq = 0;
  const unique = (label: string) => `${label}-${runId}-${seq++}`;

  const createdIds = {
    thermalReading: [] as string[],
    thermalPoint: [] as string[],
    monitoredComponent: [] as string[],
    electricalPanel: [] as string[],
    equipment: [] as string[],
    sector: [] as string[],
  };

  let sectorId: string;
  let activePointId: string;
  let activePointCode: string;
  let inactivePointId: string;
  let inactivePointCode: string;

  // IMPORTANTE: `thermalReadingService` usa o client singleton de
  // `@/lib/db/client`, que lê `DATABASE_URL` do ambiente — não
  // `TEST_DATABASE_URL`. Rodar esta suíte exige as duas variáveis apontando
  // para o MESMO banco (não há banco de teste dedicado disponível localmente
  // — mesma limitação já documentada nas suítes da Etapa 3); caso contrário
  // os fixtures criados aqui (via `prisma` local) não seriam enxergados pelo
  // service (via `DATABASE_URL`), ou vice-versa.
  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL as string } } });

    const sector = await prisma.sector.create({ data: { name: unique("sector") } });
    sectorId = sector.id;
    createdIds.sector.push(sector.id);

    const equipment = await prisma.equipment.create({
      data: { tag: unique("equip"), name: "Equipamento de teste (Etapa 4)", category: "TESTE", sectorId },
    });
    createdIds.equipment.push(equipment.id);

    const panel = await prisma.electricalPanel.create({
      data: { tag: unique("panel"), name: "Painel de teste", panelType: "MCC", sectorId, equipmentId: equipment.id },
    });
    createdIds.electricalPanel.push(panel.id);

    const component = await prisma.monitoredComponent.create({
      data: { tag: unique("cmp"), name: "Componente de teste", componentType: "CONTACTOR", panelId: panel.id },
    });
    createdIds.monitoredComponent.push(component.id);

    const activePoint = await prisma.thermalPoint.create({
      data: { code: unique("TP-ING"), name: "Ponto ativo de teste", componentId: component.id, monitoringMode: "MANUAL", active: true },
    });
    activePointId = activePoint.id;
    activePointCode = activePoint.code;
    createdIds.thermalPoint.push(activePoint.id);

    const inactivePoint = await prisma.thermalPoint.create({
      data: { code: unique("TP-ING-INACTIVE"), name: "Ponto inativo de teste", componentId: component.id, monitoringMode: "MANUAL", active: false },
    });
    inactivePointId = inactivePoint.id;
    inactivePointCode = inactivePoint.code;
    createdIds.thermalPoint.push(inactivePoint.id);
  });

  afterAll(async () => {
    await prisma.thermalReading.deleteMany({ where: { id: { in: createdIds.thermalReading } } });
    await prisma.thermalPoint.deleteMany({ where: { id: { in: createdIds.thermalPoint } } });
    await prisma.monitoredComponent.deleteMany({ where: { id: { in: createdIds.monitoredComponent } } });
    await prisma.electricalPanel.deleteMany({ where: { id: { in: createdIds.electricalPanel } } });
    await prisma.equipment.deleteMany({ where: { id: { in: createdIds.equipment } } });
    await prisma.sector.deleteMany({ where: { id: { in: createdIds.sector } } });
    await prisma.$disconnect();
  });

  it("ingestManual: persiste com source=MANUAL, analysisStatus=PENDING_AI e ΔT calculado no servidor", async () => {
    const dto = await thermalReadingService.ingestManual({
      thermalPointId: activePointId,
      measuredAt: "2026-09-01T12:00:00.000Z",
      temperatureMaxC: "75.6",
      referenceTemperatureC: "40",
    });
    createdIds.thermalReading.push(dto.id);

    expect(dto.source).toBe("MANUAL");
    expect(dto.analysisStatus).toBe("PENDING_AI");
    expect(dto.deltaTC).toBe(35.6);

    const persisted = await prisma.thermalReading.findUniqueOrThrow({ where: { id: dto.id } });
    expect(persisted.temperatureMaxC).toBe(75.6);
    expect(persisted.analysisStatus).toBe("PENDING_AI");
  });

  it("ingestManual: rejeita leitura para ponto inativo, sem gravar nada", async () => {
    const before = await prisma.thermalReading.count({ where: { thermalPointId: inactivePointId } });
    await expect(
      thermalReadingService.ingestManual({
        thermalPointId: inactivePointId,
        measuredAt: "2026-09-01T12:00:00.000Z",
        temperatureMaxC: "50",
      })
    ).rejects.toThrow();
    const after = await prisma.thermalReading.count({ where: { thermalPointId: inactivePointId } });
    expect(after).toBe(before);
  });

  it("ingestBatchByCode: persiste lote válido, rejeita código inexistente e ponto inativo (importação parcial)", async () => {
    const result = await thermalReadingService.ingestBatchByCode(
      [
        { thermalPointCode: activePointCode, measuredAt: new Date("2026-09-01T13:00:00.000Z"), temperatureMaxC: 60 },
        { thermalPointCode: "CODIGO-QUE-NAO-EXISTE", measuredAt: new Date("2026-09-01T13:00:00.000Z"), temperatureMaxC: 60 },
        { thermalPointCode: inactivePointCode, measuredAt: new Date("2026-09-01T13:00:00.000Z"), temperatureMaxC: 60 },
      ],
      "CSV"
    );

    expect(result.acceptedCount).toBe(1);
    expect(result.rejectedCount).toBe(2);

    const inserted = await prisma.thermalReading.findMany({ where: { thermalPointId: activePointId, source: "CSV" } });
    expect(inserted).toHaveLength(1);
    inserted.forEach((r) => createdIds.thermalReading.push(r.id));
  });

  it("ingestBatchByCode com source=SIMULATOR grava pelo mesmo caminho, sem nenhum campo analítico", async () => {
    const result = await thermalReadingService.ingestBatchByCode(
      [{ thermalPointCode: activePointCode, measuredAt: new Date("2026-09-01T14:00:00.000Z"), temperatureMaxC: 55.5 }],
      "SIMULATOR"
    );
    expect(result.acceptedCount).toBe(1);

    const inserted = await prisma.thermalReading.findFirst({
      where: { thermalPointId: activePointId, source: "SIMULATOR" },
      orderBy: { measuredAt: "desc" },
    });
    expect(inserted).not.toBeNull();
    expect(inserted!.analysisStatus).toBe("PENDING_AI");
    createdIds.thermalReading.push(inserted!.id);
  });

  it("nenhuma Prediction/ThermalIncident/Alert é criada como efeito colateral desta suíte de ingestão", async () => {
    const predictions = await prisma.prediction.count({ where: { thermalPointId: { in: createdIds.thermalPoint } } });
    const incidents = await prisma.thermalIncident.count({ where: { thermalPointId: { in: createdIds.thermalPoint } } });
    expect(predictions).toBe(0);
    expect(incidents).toBe(0);
  });

  it("consulta por período: listFiltered com from/to devolve só as leituras dentro da janela", async () => {
    const { items } = await thermalReadingService.listFiltered({
      thermalPointId: activePointId,
      from: new Date("2026-09-01T13:30:00.000Z"),
      to: new Date("2026-09-01T14:30:00.000Z"),
    });
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(item.measuredAt.getTime()).toBeGreaterThanOrEqual(new Date("2026-09-01T13:30:00.000Z").getTime());
      expect(item.measuredAt.getTime()).toBeLessThanOrEqual(new Date("2026-09-01T14:30:00.000Z").getTime());
    }
  });
});
