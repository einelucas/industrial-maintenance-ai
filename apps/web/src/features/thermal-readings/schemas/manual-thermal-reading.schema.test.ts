import { describe, expect, it } from "vitest";
import { manualThermalReadingSchema } from "./manual-thermal-reading.schema";

const validBase = {
  measuredAt: "2026-09-01T12:00:00.000Z",
  temperatureMaxC: "75.6",
  thermalPointId: "123e4567-e89b-12d3-a456-426614174000",
};

describe("manualThermalReadingSchema", () => {
  it("aceita um payload manual mínimo válido", () => {
    expect(manualThermalReadingSchema.safeParse(validBase).success).toBe(true);
  });

  it("exige thermalPointId como UUID (select real, nunca texto livre)", () => {
    const result = manualThermalReadingSchema.safeParse({ ...validBase, thermalPointId: "TP-001" });
    expect(result.success).toBe(false);
  });

  it("continua aplicando as regras de medição compartilhadas (ex.: temperatura implausível)", () => {
    const result = manualThermalReadingSchema.safeParse({ ...validBase, temperatureMaxC: "9999" });
    expect(result.success).toBe(false);
  });
});
