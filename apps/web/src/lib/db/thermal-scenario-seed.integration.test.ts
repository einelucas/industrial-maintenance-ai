import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedThermalScenario } from "../thermal-simulation/seed-thermal-scenario";

// Testes de integração do seed termográfico determinístico (Etapa 2 / GPMS
// 2026). Exercitam a persistência real no PostgreSQL — nunca mocks. Exigem
// TEST_DATABASE_URL apontando para um banco de teste. Sem essa variável, a
// suíte inteira é pulada.
//
// IMPORTANTE: esta suíte NUNCA apaga o cenário térmico ao final. O que
// `seedThermalScenario` grava é o próprio cenário demonstrativo real da
// aplicação (não uma fixture descartável) — rodando contra um banco de
// teste dedicado, o cenário simplesmente fica lá (o que é correto); rodando
// por engano contra o banco da aplicação, nada é destruído, porque o seed é
// idempotente e a suíte é só leitura depois de semear. Um `deleteMany()` sem
// filtro aqui já apagou os dados reais uma vez nesta sessão — não repetir.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("Seed termográfico — integração PostgreSQL (Etapa 2)", () => {
  let prisma: PrismaClient;
  let manifestDir: string;
  let manifestPath: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL as string } } });
    manifestDir = mkdtempSync(path.join(tmpdir(), "gpms-demo-manifest-"));
    manifestPath = path.join(manifestDir, "reserved_plant_manifest.json");
  });

  afterAll(async () => {
    // Deliberadamente não apaga nada: o cenário semeado é o dado real da
    // aplicação, não uma fixture desta suíte. Ver nota acima.
    await prisma.$disconnect();
    rmSync(manifestDir, { recursive: true, force: true });
  });

  it(
    "persiste exatamente 55 pontos termográficos, com 19 marcados historicamente como anômalos",
    async () => {
      await seedThermalScenario(prisma, { manifestPath });

      const total = await prisma.thermalPoint.count();
      const anomalous = await prisma.thermalPoint.count({ where: { initiallyAnomalous: true } });
      expect(total).toBe(55);
      expect(anomalous).toBe(19);
    },
    60_000
  );

  it("os códigos TP-001..TP-055 existem e são únicos", async () => {
    const points = await prisma.thermalPoint.findMany({ select: { code: true } });
    const codes = points.map((p) => p.code).sort();
    expect(new Set(codes).size).toBe(55);
    for (let i = 1; i <= 55; i++) {
      expect(codes).toContain(`TP-${String(i).padStart(3, "0")}`);
    }
  });

  it("todos os pontos têm relações estruturais válidas até o setor", async () => {
    const points = await prisma.thermalPoint.findMany({
      include: { component: { include: { panel: { include: { sector: true, equipment: true } } } } },
    });
    expect(points).toHaveLength(55);
    for (const point of points) {
      expect(point.component).toBeTruthy();
      expect(point.component.panel).toBeTruthy();
      expect(point.component.panel.sector).toBeTruthy();
    }
  });

  it("o caso crítico oficial está persistido com 75.6 °C, referência 40.0 °C e deltaT 35.6 °C", async () => {
    const criticalReading = await prisma.thermalReading.findFirst({
      where: { temperatureMaxC: 75.6, referenceTemperatureC: 40.0 },
      include: { thermalPoint: true },
    });
    expect(criticalReading).not.toBeNull();
    expect(criticalReading!.deltaTC).toBeCloseTo(35.6, 5);
    expect(criticalReading!.thermalPoint.initiallyAnomalous).toBe(true);
  });

  it("as séries persistidas por ponto estão em ordem cronológica", async () => {
    const point = await prisma.thermalPoint.findFirstOrThrow({ where: { code: "TP-001" } });
    const readings = await prisma.thermalReading.findMany({
      where: { thermalPointId: point.id },
      orderBy: { measuredAt: "asc" },
    });
    expect(readings.length).toBeGreaterThan(0);
    for (let i = 1; i < readings.length; i++) {
      expect(readings[i]!.measuredAt.getTime()).toBeGreaterThan(readings[i - 1]!.measuredAt.getTime());
    }
  });

  it("nenhum dado mecânico legado (motores/bombas/etc.) permanece no seed ativo", async () => {
    const legacy = await prisma.equipment.count({
      where: { category: { in: ["Motor", "Bomba", "Compressor", "Redutor", "Ventilador", "Caldeira"] } },
    });
    expect(legacy).toBe(0);
  });

  it("usuários de demonstração continuam acessíveis", async () => {
    const admin = await prisma.user.findUnique({ where: { email: "admin@pcm.local" } });
    const planner = await prisma.user.findUnique({ where: { email: "planejador@pcm.local" } });
    expect(admin?.active).toBe(true);
    expect(planner?.active).toBe(true);
  });

  it("antes de qualquer inferência de IA: Prediction, ThermalIncident, alertas de risco e OS preditivas estão zerados", async () => {
    expect(await prisma.prediction.count()).toBe(0);
    expect(await prisma.thermalIncident.count()).toBe(0);
    expect(await prisma.alert.count()).toBe(0);
    expect(await prisma.workOrder.count({ where: { type: "PREDICTIVE" } })).toBe(0);
  });

  it("o manifesto de ground truth é escrito e contém seed, período e o caso crítico esperado", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.totalPoints).toBe(55);
    expect(manifest.initiallyAnomalousCount).toBe(19);
    expect(manifest.officialCriticalCase.peak.temperatureMaxC).toBe(75.6);
    expect(manifest.officialCriticalCase.reservedPostAction.readings.length).toBeGreaterThan(0);
  });

  it(
    "é idempotente: reexecutar o seed não duplica pontos, dispositivos nem leituras",
    async () => {
      const before = {
        points: await prisma.thermalPoint.count(),
        devices: await prisma.sensorDevice.count(),
        readings: await prisma.thermalReading.count(),
        sectors: await prisma.sector.count({ where: { id: { startsWith: "demo-sector-" } } }),
      };

      const result = await seedThermalScenario(prisma, { manifestPath });

      const after = {
        points: await prisma.thermalPoint.count(),
        devices: await prisma.sensorDevice.count(),
        readings: await prisma.thermalReading.count(),
        sectors: await prisma.sector.count({ where: { id: { startsWith: "demo-sector-" } } }),
      };

      expect(after).toEqual(before);
      expect(result.skippedExistingPoints).toBe(55);
      expect(result.readingsInserted).toBe(0);
    },
    60_000
  );
});
