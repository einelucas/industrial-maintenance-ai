import { describe, expect, it } from "vitest";
import { computeNextExecution } from "./next-execution";

describe("computeNextExecution", () => {
  const base = new Date(2026, 0, 15); // 15/jan/2026

  it("DAILY avança em dias", () => {
    expect(computeNextExecution(base, "DAILY", 3)).toEqual(new Date(2026, 0, 18));
  });

  it("WEEKLY avança em semanas", () => {
    expect(computeNextExecution(base, "WEEKLY", 2)).toEqual(new Date(2026, 0, 29));
  });

  it("MONTHLY avança em meses", () => {
    expect(computeNextExecution(base, "MONTHLY", 1)).toEqual(new Date(2026, 1, 15));
  });

  it("QUARTERLY avança 3 meses por unidade", () => {
    expect(computeNextExecution(base, "QUARTERLY", 1)).toEqual(new Date(2026, 3, 15));
  });

  it("SEMIANNUAL avança 6 meses por unidade", () => {
    expect(computeNextExecution(base, "SEMIANNUAL", 1)).toEqual(new Date(2026, 6, 15));
  });

  it("ANNUAL avança em anos", () => {
    expect(computeNextExecution(base, "ANNUAL", 1)).toEqual(new Date(2027, 0, 15));
  });

  it("CUSTOM_DAYS avança em dias", () => {
    expect(computeNextExecution(base, "CUSTOM_DAYS", 10)).toEqual(new Date(2026, 0, 25));
  });

  it("calcula a partir da data informada, não de 'agora'", () => {
    const farPast = new Date(2020, 0, 1);
    const result = computeNextExecution(farPast, "MONTHLY", 1);
    expect(result).toEqual(new Date(2020, 1, 1));
  });
});
