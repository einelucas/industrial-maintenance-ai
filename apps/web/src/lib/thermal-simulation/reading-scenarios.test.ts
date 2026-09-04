import { describe, expect, it } from "vitest";
import { generateScenarioReadings, SIMULATOR_SCENARIOS, type GenerateScenarioParams } from "./reading-scenarios";

const baseParams: Omit<GenerateScenarioParams, "scenario"> = {
  thermalPointCode: "TP-039",
  seed: 42,
  sampleCount: 10,
  intervalMinutes: 15,
  endAt: new Date("2026-09-03T12:00:00.000Z"),
};

describe("generateScenarioReadings — determinismo", () => {
  it("a mesma seed produz exatamente a mesma série", () => {
    const a = generateScenarioReadings({ ...baseParams, scenario: "PROGRESSIVE_HEATING" });
    const b = generateScenarioReadings({ ...baseParams, scenario: "PROGRESSIVE_HEATING" });
    expect(a).toEqual(b);
  });

  it("seeds diferentes produzem séries diferentes", () => {
    const a = generateScenarioReadings({ ...baseParams, scenario: "PROGRESSIVE_HEATING", seed: 1 });
    const b = generateScenarioReadings({ ...baseParams, scenario: "PROGRESSIVE_HEATING", seed: 2 });
    expect(a).not.toEqual(b);
  });

  it("nunca usa o relógio real — a mesma chamada com endAt fixo é estável entre execuções", () => {
    const a = generateScenarioReadings({ ...baseParams, scenario: "NORMAL_LOW_LOAD" });
    const lastTimestamp = a[a.length - 1]!.measuredAt.toISOString();
    expect(lastTimestamp).toBe(baseParams.endAt.toISOString());
  });
});

describe("generateScenarioReadings — todos os 9 cenários nomeados existem e geram algo coerente", () => {
  it.each(SIMULATOR_SCENARIOS)("cenário %s não lança e devolve um array", (scenario) => {
    const rows = generateScenarioReadings({ ...baseParams, scenario });
    expect(Array.isArray(rows)).toBe(true);
    for (const row of rows) {
      expect(row.thermalPointCode).toBe("TP-039");
      expect(row.measuredAt).toBeInstanceOf(Date);
      expect(typeof row.temperatureMaxC).toBe("number");
    }
  });
});

describe("cenário CRITICAL_75_6", () => {
  it("termina exatamente em 75.6 °C com referência 40.0 °C (ΔT 35.6)", () => {
    const rows = generateScenarioReadings({ ...baseParams, scenario: "CRITICAL_75_6" });
    const last = rows[rows.length - 1]!;
    expect(last.temperatureMaxC).toBe(75.6);
    expect(last.referenceTemperatureC).toBe(40.0);
  });

  it("chega ao pico por uma evolução plausível, não como amostra isolada", () => {
    const rows = generateScenarioReadings({ ...baseParams, scenario: "CRITICAL_75_6", sampleCount: 20 });
    const first = rows[0]!.temperatureMaxC;
    const last = rows[rows.length - 1]!.temperatureMaxC;
    expect(last).toBeGreaterThan(first);
  });
});

describe("cenário SENSOR_OFFLINE", () => {
  it("nunca fabrica uma leitura com temperatura zero — representa a lacuna pela ausência de linhas", () => {
    const rows = generateScenarioReadings({ ...baseParams, scenario: "SENSOR_OFFLINE", sampleCount: 12 });
    expect(rows.length).toBeLessThan(12);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.temperatureMaxC).not.toBe(0);
    }
  });

  it("as amostras geradas ficam apenas no início da janela — nada aparece perto do instante mais recente solicitado", () => {
    const rows = generateScenarioReadings({ ...baseParams, scenario: "SENSOR_OFFLINE", sampleCount: 12 });
    const lastGenerated = rows[rows.length - 1]!.measuredAt.getTime();
    expect(lastGenerated).toBeLessThan(baseParams.endAt.getTime());
  });
});

describe("cenário INVALID_SENSOR", () => {
  it("gera valores fora de qualquer faixa plausível, de propósito", () => {
    const rows = generateScenarioReadings({ ...baseParams, scenario: "INVALID_SENSOR" });
    for (const row of rows) {
      expect(Math.abs(row.temperatureMaxC)).toBeGreaterThan(500);
    }
  });
});

describe("cenário OVERLOAD", () => {
  it("mantém carga acima de 100% durante toda a série", () => {
    const rows = generateScenarioReadings({ ...baseParams, scenario: "OVERLOAD" });
    for (const row of rows) {
      expect(row.loadPercent).toBeGreaterThan(100);
    }
  });
});
