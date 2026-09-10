import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticateTelemetryDevice } from "@/features/telemetry/services/device-auth.service";
import { thermalTelemetryService } from "@/features/telemetry/services/thermal-telemetry.service";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("Telemetria térmica — integração PostgreSQL (Etapa 9)", () => {
  let prisma: PrismaClient;
  const runId = randomUUID().slice(0, 8);
  const apiKey = `telemetry-test-${randomUUID()}`;
  let sectorId: string;
  let equipmentId: string;
  let panelId: string;
  let componentId: string;
  let pointId: string;
  let pointCode: string;
  let deviceId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL as string } } });
    const sector = await prisma.sector.create({ data: { name: `telemetry-sector-${runId}` } });
    sectorId = sector.id;
    const equipment = await prisma.equipment.create({
      data: { tag: `TEL-EQ-${runId}`, name: "Equipamento de telemetria", category: "TESTE", sectorId },
    });
    equipmentId = equipment.id;
    const panel = await prisma.electricalPanel.create({
      data: { tag: `TEL-PNL-${runId}`, name: "Painel de telemetria", panelType: "MCC", sectorId, equipmentId },
    });
    panelId = panel.id;
    const component = await prisma.monitoredComponent.create({
      data: { tag: `TEL-CMP-${runId}`, name: "Componente de telemetria", componentType: "CONTACTOR", panelId },
    });
    componentId = component.id;
    const point = await prisma.thermalPoint.create({
      data: { code: `TP-TEL-${runId}`.toUpperCase(), name: "Ponto de telemetria", componentId, monitoringMode: "POINT_SENSOR", active: true, sampleIntervalSec: 60 },
    });
    pointId = point.id;
    pointCode = point.code;
    const device = await prisma.sensorDevice.create({
      data: {
        serialNumber: `TEL-DEV-${runId}`,
        name: "Dispositivo de telemetria",
        thermalPointId: pointId,
        apiKeyHash: createHash("sha256").update(apiKey).digest("hex"),
        status: "PROVISIONING",
        credentialRotatedAt: new Date(),
      },
    });
    deviceId = device.id;
  });

  afterAll(async () => {
    await prisma.deviceTechnicalAlert.deleteMany({ where: { sensorDeviceId: deviceId } });
    await prisma.deviceTelemetryRequest.deleteMany({ where: { sensorDeviceId: deviceId } });
    await prisma.inferenceRequest.deleteMany({ where: { thermalPointId: pointId } });
    await prisma.thermalReading.deleteMany({ where: { thermalPointId: pointId } });
    await prisma.sensorDevice.delete({ where: { id: deviceId } });
    await prisma.thermalPoint.delete({ where: { id: pointId } });
    await prisma.monitoredComponent.delete({ where: { id: componentId } });
    await prisma.electricalPanel.delete({ where: { id: panelId } });
    await prisma.equipment.delete({ where: { id: equipmentId } });
    await prisma.sector.delete({ where: { id: sectorId } });
    await prisma.$disconnect();
  });

  async function authenticatedDevice() {
    return authenticateTelemetryDevice(new Request("http://localhost/api/v1/telemetry/thermal-readings", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "x-device-id": deviceId, "x-forwarded-for": "127.0.0.9" },
    }));
  }

  it("autentica por credencial individual e não expõe o segredo", async () => {
    const device = await authenticatedDevice();
    expect(device.id).toBe(deviceId);
    expect(device.thermalPoint.code).toBe(pointCode);
    expect(JSON.stringify(device)).not.toContain(apiKey);
  }, 30_000);

  it("persiste leitura + job atomicamente e reenviar a sequência é idempotente", async () => {
    const device = await authenticatedDevice();
    const sequence = Math.floor(Date.now() / 1000);
    const measuredAt = new Date().toISOString();
    const envelope = {
      schemaVersion: "thermal-telemetry-v1",
      readings: [{ sequence, thermalPointCode: pointCode, measuredAt, temperatureMaxC: 75.6, referenceTemperatureC: 40, currentA: 27.4, loadPercent: 86 }],
    };

    const first = await thermalTelemetryService.ingest(envelope, device);
    expect(first).toMatchObject({ acceptedCount: 1, duplicateCount: 0, queuedCount: 1 });
    const second = await thermalTelemetryService.ingest(envelope, device);
    expect(second).toMatchObject({ acceptedCount: 0, duplicateCount: 1, queuedCount: 0 });
    expect(second.results[0]).toMatchObject({ status: "DUPLICATE", code: "ALREADY_RECEIVED" });

    expect(await prisma.thermalReading.count({ where: { sensorDeviceId: deviceId, sequence: BigInt(sequence) } })).toBe(1);
    expect(await prisma.inferenceRequest.count({ where: { thermalReading: { sensorDeviceId: deviceId, sequence: BigInt(sequence) } } })).toBe(1);
    expect(await prisma.prediction.count({ where: { thermalPointId: pointId } })).toBe(0);
    expect(await prisma.thermalIncident.count({ where: { thermalPointId: pointId } })).toBe(0);

    const updatedDevice = await prisma.sensorDevice.findUniqueOrThrow({ where: { id: deviceId } });
    expect(updatedDevice.status).toBe("ONLINE");
    expect(updatedDevice.lastSeenAt).not.toBeNull();
    expect(updatedDevice.lastSequence).toBe(BigInt(sequence));
  }, 30_000);

  it("aceita lote atrasado dentro da janela e rejeita ponto não autorizado por item", async () => {
    const device = await authenticatedDevice();
    const result = await thermalTelemetryService.ingest({
      schemaVersion: "thermal-telemetry-v1",
      readings: [
        { sequence: Math.floor(Date.now() / 1000) + 10, thermalPointCode: pointCode, measuredAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), temperatureMaxC: 48 },
        { sequence: Math.floor(Date.now() / 1000) + 11, thermalPointCode: "TP-NAO-AUTORIZADO", measuredAt: new Date().toISOString(), temperatureMaxC: 48 },
      ],
    }, device);
    expect(result).toMatchObject({ acceptedCount: 1, rejectedCount: 1, queuedCount: 1 });
    expect(result.results[1]).toMatchObject({ status: "REJECTED", code: "POINT_NOT_AUTHORIZED" });
  }, 30_000);
});
