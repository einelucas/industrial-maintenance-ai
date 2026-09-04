import { describe, expect, it } from "vitest";
import { calculateDeltaT, calculateRiseAboveAmbient, roundThermalValue } from "./thermal-reading-calculations";

describe("calculateDeltaT", () => {
  it("calcula o caso oficial do desafio: 75.6 - 40 = 35.6", () => {
    expect(calculateDeltaT(75.6, 40)).toBe(35.6);
  });

  it("devolve null quando a referência está ausente — nunca 0", () => {
    expect(calculateDeltaT(60, null)).toBeNull();
    expect(calculateDeltaT(60, undefined)).toBeNull();
  });

  it("aceita temperatura máxima negativa (câmara fria) sem rejeitar", () => {
    expect(calculateDeltaT(-18, -22)).toBe(4);
  });

  it("devolve null para NaN ou Infinity em qualquer um dos lados", () => {
    expect(calculateDeltaT(Number.NaN, 40)).toBeNull();
    expect(calculateDeltaT(75.6, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("arredonda para 1 casa decimal", () => {
    expect(calculateDeltaT(50.37, 40.11)).toBe(10.3);
  });
});

describe("calculateRiseAboveAmbient", () => {
  it("calcula a elevação acima do ambiente", () => {
    expect(calculateRiseAboveAmbient(75.6, 28)).toBe(47.6);
  });

  it("devolve null quando o ambiente está ausente", () => {
    expect(calculateRiseAboveAmbient(75.6, null)).toBeNull();
  });

  it("nunca sobrescreve nem depende do ΔT — são cálculos independentes", () => {
    const deltaT = calculateDeltaT(75.6, 40);
    const rise = calculateRiseAboveAmbient(75.6, 28);
    expect(deltaT).toBe(35.6);
    expect(rise).toBe(47.6);
    expect(deltaT).not.toBe(rise);
  });
});

describe("roundThermalValue", () => {
  it("arredonda de forma consistente para 1 casa decimal", () => {
    expect(roundThermalValue(10.049)).toBe(10);
    expect(roundThermalValue(10.05)).toBe(10.1);
    expect(roundThermalValue(-3.14)).toBe(-3.1);
  });
});
