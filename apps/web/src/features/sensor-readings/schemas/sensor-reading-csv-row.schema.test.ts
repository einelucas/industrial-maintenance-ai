import { describe, expect, it } from "vitest";
import { sensorReadingCsvRowSchema } from "./sensor-reading-csv-row.schema";

describe("sensorReadingCsvRowSchema", () => {
  it("aceita uma linha completa", () => {
    const result = sensorReadingCsvRowSchema.safeParse({
      measuredAt: "2026-01-15T10:00:00Z",
      temperature: "45.5",
      vibration: "2.1",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita measuredAt inválido", () => {
    expect(sensorReadingCsvRowSchema.safeParse({ measuredAt: "not-a-date" }).success).toBe(false);
  });

  it("trata células numéricas vazias como ausentes, não como zero", () => {
    const result = sensorReadingCsvRowSchema.safeParse({
      measuredAt: "2026-01-15T10:00:00Z",
      temperature: "",
    });
    expect(result.success && result.data.temperature).toBeUndefined();
  });

  it("aceita linha só com data (todas as métricas opcionais)", () => {
    const result = sensorReadingCsvRowSchema.safeParse({ measuredAt: "2026-01-15T10:00:00Z" });
    expect(result.success).toBe(true);
  });
});
