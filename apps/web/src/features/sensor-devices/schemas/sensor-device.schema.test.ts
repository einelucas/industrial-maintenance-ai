import { describe, expect, it } from "vitest";
import { sensorDeviceProvisionSchema } from "./sensor-device.schema";

const VALID = {
  serialNumber: "esp32-gpms-001",
  name: "Sensor de teste",
  thermalPointId: "11111111-1111-1111-1111-111111111111",
};

describe("sensorDeviceProvisionSchema", () => {
  it("aceita entrada válida e normaliza o número de série", () => {
    const result = sensorDeviceProvisionSchema.parse(VALID);
    expect(result.serialNumber).toBe("ESP32-GPMS-001");
  });

  it('rejeita número de série com prefixo reservado "SIM-" do simulador', () => {
    expect(sensorDeviceProvisionSchema.safeParse({ ...VALID, serialNumber: "SIM-TP-001" }).success).toBe(false);
    expect(sensorDeviceProvisionSchema.safeParse({ ...VALID, serialNumber: "sim-tp-001" }).success).toBe(false);
  });

  it("rejeita ponto termográfico inválido (não-UUID)", () => {
    expect(sensorDeviceProvisionSchema.safeParse({ ...VALID, thermalPointId: "abc" }).success).toBe(false);
  });

  it("nunca aceita apiKeyHash, status ou campos de telemetria vindos do cliente", () => {
    const result = sensorDeviceProvisionSchema.parse({
      ...VALID,
      apiKeyHash: "forjado",
      status: "ONLINE",
      lastSeenAt: "2026-01-01",
      lastSequence: "999",
    });
    expect(result).not.toHaveProperty("apiKeyHash");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("lastSeenAt");
    expect(result).not.toHaveProperty("lastSequence");
  });
});
