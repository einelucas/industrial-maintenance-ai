import { describe, expect, it } from "vitest";
import { csvThermalReadingRowSchema } from "./csv-thermal-reading-row.schema";

const validBase = {
  measuredAt: "2026-09-01T12:00:00.000Z",
  temperatureMaxC: "75.6",
  thermalPointCode: "tp-039",
};

describe("csvThermalReadingRowSchema", () => {
  it("aceita uma linha válida e normaliza o código para maiúsculas", () => {
    const result = csvThermalReadingRowSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.thermalPointCode).toBe("TP-039");
    }
  });

  it("rejeita código de ponto vazio", () => {
    const result = csvThermalReadingRowSchema.safeParse({ ...validBase, thermalPointCode: "" });
    expect(result.success).toBe(false);
  });

  it("continua aplicando as regras de medição compartilhadas", () => {
    const result = csvThermalReadingRowSchema.safeParse({ ...validBase, temperatureAverageC: "9999" });
    expect(result.success).toBe(false);
  });
});
