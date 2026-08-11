import { describe, expect, it } from "vitest";
import { riskThresholdSchema } from "./risk-threshold.schema";

describe("riskThresholdSchema", () => {
  const valid = { lowMax: "30", moderateMax: "60", highMax: "80" };

  it("aceita percentuais válidos", () => {
    expect(riskThresholdSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita valor abaixo de 1%", () => {
    expect(riskThresholdSchema.safeParse({ ...valid, lowMax: "0" }).success).toBe(false);
  });

  it("rejeita valor acima de 98%", () => {
    expect(riskThresholdSchema.safeParse({ ...valid, highMax: "99" }).success).toBe(false);
  });

  it("coage strings numéricas", () => {
    const result = riskThresholdSchema.safeParse(valid);
    expect(result.success && result.data.lowMax).toBe(30);
  });
});
