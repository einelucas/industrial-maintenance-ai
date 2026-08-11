import { describe, expect, it } from "vitest";
import { sensorReadingSchema } from "./sensor-reading.schema";

describe("sensorReadingSchema", () => {
  const equipmentId = "123e4567-e89b-12d3-a456-426614174000";

  it("aceita leitura com apenas alguns sensores preenchidos (nem todo equipamento tem todos)", () => {
    const result = sensorReadingSchema.safeParse({ equipmentId, temperature: "80" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temperature).toBe(80);
      expect(result.data.vibration).toBeUndefined();
    }
  });

  it("usa MANUAL como source padrão quando não informado", () => {
    const result = sensorReadingSchema.safeParse({ equipmentId, temperature: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("MANUAL");
    }
  });

  it("rejeita equipmentId inválido", () => {
    expect(sensorReadingSchema.safeParse({ equipmentId: "abc", temperature: "50" }).success).toBe(false);
  });

  it("coage strings numéricas vindas de FormData para number", () => {
    const result = sensorReadingSchema.safeParse({
      equipmentId,
      temperature: "82.5",
      vibration: "6.1",
      rpm: "1800",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temperature).toBe(82.5);
      expect(result.data.vibration).toBe(6.1);
      expect(result.data.rpm).toBe(1800);
    }
  });

  it("rejeita source fora do enum", () => {
    const result = sensorReadingSchema.safeParse({ equipmentId, source: "BLUETOOTH" });
    expect(result.success).toBe(false);
  });
});
