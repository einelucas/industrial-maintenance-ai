import { describe, expect, it } from "vitest";
import { thermalReadingMeasurementSchema } from "./thermal-reading-measurement.schema";

const validBase = {
  measuredAt: "2026-09-01T12:00:00.000Z",
  temperatureMaxC: "75.6",
};

describe("thermalReadingMeasurementSchema", () => {
  it("aceita o payload mínimo (só data e temperatura máxima)", () => {
    const result = thermalReadingMeasurementSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("trata campo vazio como ausência, nunca como zero", () => {
    const result = thermalReadingMeasurementSchema.safeParse({
      ...validBase,
      referenceTemperatureC: "",
      ambientTemperatureC: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.referenceTemperatureC).toBeUndefined();
      expect(result.data.ambientTemperatureC).toBeUndefined();
    }
  });

  it("aceita temperatura negativa plausível (câmara fria)", () => {
    const result = thermalReadingMeasurementSchema.safeParse({ ...validBase, temperatureMaxC: "-18.5" });
    expect(result.success).toBe(true);
  });

  it("rejeita NaN/Infinity disfarçado de string", () => {
    expect(thermalReadingMeasurementSchema.safeParse({ ...validBase, temperatureMaxC: "NaN" }).success).toBe(false);
    expect(thermalReadingMeasurementSchema.safeParse({ ...validBase, temperatureMaxC: "Infinity" }).success).toBe(false);
  });

  it("rejeita temperatura fora da faixa plausível (erro grosseiro de digitação)", () => {
    expect(thermalReadingMeasurementSchema.safeParse({ ...validBase, temperatureMaxC: "9999" }).success).toBe(false);
  });

  it("rejeita corrente e carga negativas", () => {
    expect(thermalReadingMeasurementSchema.safeParse({ ...validBase, currentA: "-5" }).success).toBe(false);
    expect(thermalReadingMeasurementSchema.safeParse({ ...validBase, loadPercent: "-1" }).success).toBe(false);
  });

  it("rejeita temperatura média maior que a máxima", () => {
    const result = thermalReadingMeasurementSchema.safeParse({
      ...validBase,
      temperatureMaxC: "50",
      temperatureAverageC: "60",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita data de medição no futuro", () => {
    const farFuture = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = thermalReadingMeasurementSchema.safeParse({ ...validBase, measuredAt: farFuture });
    expect(result.success).toBe(false);
  });

  it("rejeita emissividade fora de (0, 1]", () => {
    expect(thermalReadingMeasurementSchema.safeParse({ ...validBase, emissivity: "0" }).success).toBe(false);
    expect(thermalReadingMeasurementSchema.safeParse({ ...validBase, emissivity: "1.5" }).success).toBe(false);
    expect(thermalReadingMeasurementSchema.safeParse({ ...validBase, emissivity: "0.95" }).success).toBe(true);
  });

  it("nunca aceita campos analíticos ou de proveniência — são descartados silenciosamente", () => {
    const result = thermalReadingMeasurementSchema.parse({
      ...validBase,
      riskLevel: "CRITICAL",
      source: "SIMULATOR",
      analysisStatus: "ANALYZED",
      deltaTC: 999,
    });
    expect(result).not.toHaveProperty("riskLevel");
    expect(result).not.toHaveProperty("source");
    expect(result).not.toHaveProperty("analysisStatus");
    expect(result).not.toHaveProperty("deltaTC");
  });
});
