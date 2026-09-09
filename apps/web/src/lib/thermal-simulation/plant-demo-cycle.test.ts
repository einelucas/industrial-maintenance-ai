import { describe, expect, it } from "vitest";
import { buildPlantDemoCycle, PLANT_DEMO_SAMPLE_COUNT } from "./plant-demo-cycle";

describe("buildPlantDemoCycle", () => {
  const endAt = new Date("2026-09-09T12:00:00.000Z");

  it("gera uma janela sincronizada para 55 pontos e 19 degradações reservadas", () => {
    const cycle = buildPlantDemoCycle(endAt);
    expect(cycle.pointCount).toBe(55);
    expect(cycle.expectedAnomalousPointCount).toBe(19);
    expect(cycle.rows).toHaveLength(55 * PLANT_DEMO_SAMPLE_COUNT);
    const latest = cycle.rows.filter((row) => row.measuredAt.getTime() === endAt.getTime());
    expect(latest).toHaveLength(55);
    expect(new Set(latest.map((row) => row.thermalPointCode)).size).toBe(55);
  });

  it("mantém o caso oficial em 75,6 °C / referência 40 °C sem incluir rótulos no payload", () => {
    const cycle = buildPlantDemoCycle(endAt);
    const critical = cycle.rows.find((row) => row.thermalPointCode === "TP-039" && row.measuredAt.getTime() === endAt.getTime());
    expect(critical?.temperatureMaxC).toBe(75.6);
    expect(critical?.referenceTemperatureC).toBe(40);
    expect(critical).not.toHaveProperty("initiallyAnomalous");
    expect(critical).not.toHaveProperty("cause");
  });

  it("encerra exatamente os 19 sinais de defeito acima do limiar de atenção", () => {
    const cycle = buildPlantDemoCycle(endAt);
    const latest = cycle.rows.filter((row) => row.measuredAt.getTime() === endAt.getTime());
    const aboveAttention = latest.filter((row) => row.temperatureMaxC - row.referenceTemperatureC >= 10);
    expect(aboveAttention).toHaveLength(19);
  });

  it("é determinístico para o mesmo instante de encerramento", () => {
    expect(buildPlantDemoCycle(endAt)).toEqual(buildPlantDemoCycle(endAt));
  });
});
