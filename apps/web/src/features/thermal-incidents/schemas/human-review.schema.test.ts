import { describe, expect, it } from "vitest";
import { humanReviewDecisionSchema } from "./human-review.schema";

const base = { thermalIncidentId: "123e4567-e89b-12d3-a456-426614174000" };

describe("humanReviewDecisionSchema", () => {
  it("aceita CONFIRMED sem justificativa", () => {
    expect(humanReviewDecisionSchema.safeParse({ ...base, decision: "CONFIRMED" }).success).toBe(true);
  });

  it("aceita CONFIRMED com justificativa opcional", () => {
    expect(humanReviewDecisionSchema.safeParse({ ...base, decision: "CONFIRMED", justification: "Confirmado em campo." }).success).toBe(true);
  });

  it.each(["REJECTED", "INCONCLUSIVE", "NEW_READING_REQUIRED"])("exige justificativa para %s", (decision) => {
    const result = humanReviewDecisionSchema.safeParse({ ...base, decision });
    expect(result.success).toBe(false);
  });

  it.each(["REJECTED", "INCONCLUSIVE", "NEW_READING_REQUIRED"])("aceita %s quando a justificativa é informada", (decision) => {
    const result = humanReviewDecisionSchema.safeParse({ ...base, decision, justification: "Motivo detalhado da decisão." });
    expect(result.success).toBe(true);
  });

  it("rejeita decisão fora do enum permitido", () => {
    expect(humanReviewDecisionSchema.safeParse({ ...base, decision: "APPROVED" }).success).toBe(false);
  });

  it("rejeita thermalIncidentId que não é UUID", () => {
    expect(humanReviewDecisionSchema.safeParse({ thermalIncidentId: "abc", decision: "CONFIRMED" }).success).toBe(false);
  });

  it("nunca aceita modelScore, checksum ou versão — o humano não reescreve a inferência original", () => {
    const parsed = humanReviewDecisionSchema.parse({ ...base, decision: "CONFIRMED", modelScore: 999, modelChecksum: "sha256:forjado" });
    expect(parsed).not.toHaveProperty("modelScore");
    expect(parsed).not.toHaveProperty("modelChecksum");
  });
});
