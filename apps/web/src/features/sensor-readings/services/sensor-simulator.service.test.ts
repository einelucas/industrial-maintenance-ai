import { describe, expect, it } from "vitest";
import { simulateReading } from "./sensor-simulator.service";

describe("simulateReading", () => {
  it("gera valores dentro da faixa NORMAL (temperatura mais baixa que CRITICAL)", () => {
    const reading = simulateReading("NORMAL");
    expect(reading.temperature).toBeGreaterThanOrEqual(45);
    expect(reading.temperature).toBeLessThanOrEqual(65);
    expect(reading.vibration).toBeGreaterThanOrEqual(1);
    expect(reading.vibration).toBeLessThanOrEqual(3);
  });

  it("gera valores dentro da faixa ATTENTION", () => {
    const reading = simulateReading("ATTENTION");
    expect(reading.temperature).toBeGreaterThanOrEqual(65);
    expect(reading.temperature).toBeLessThanOrEqual(78);
  });

  it("gera valores dentro da faixa CRITICAL, sempre mais altos que NORMAL", () => {
    const reading = simulateReading("CRITICAL");
    expect(reading.temperature).toBeGreaterThanOrEqual(78);
    expect(reading.vibration).toBeGreaterThanOrEqual(5);
    expect(reading.current).toBeGreaterThanOrEqual(20);
  });

  it("sempre retorna todas as onze medições preenchidas", () => {
    const reading = simulateReading("NORMAL");
    expect(Object.keys(reading).sort()).toEqual(
      [
        "airTemperature",
        "current",
        "operatingHours",
        "pressure",
        "processTemperature",
        "rotationalSpeed",
        "rpm",
        "temperature",
        "toolWear",
        "torque",
        "vibration",
      ].sort()
    );
    for (const value of Object.values(reading)) {
      expect(typeof value).toBe("number");
      expect(Number.isNaN(value)).toBe(false);
    }
  });
});
