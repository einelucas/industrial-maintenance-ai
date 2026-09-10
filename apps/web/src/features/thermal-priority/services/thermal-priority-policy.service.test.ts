import { describe, expect, it } from "vitest";
import { DEMO_RISK_TO_COMPANY_PRIORITY, recommendCompanyPriority } from "./thermal-priority-policy.service";

describe("recommendCompanyPriority", () => {
  const policy = { version: "test", status: "DEMO_DRAFT" as const, riskMapping: DEMO_RISK_TO_COMPANY_PRIORITY };

  it("mantém risco da IA separado da prioridade empresarial", () => {
    expect(recommendCompanyPriority(policy as never, "LOW")).toBe("P5");
    expect(recommendCompanyPriority(policy as never, "MODERATE")).toBe("P10");
    expect(recommendCompanyPriority(policy as never, "HIGH")).toBe("P20");
    expect(recommendCompanyPriority(policy as never, "CRITICAL")).toBe("P20");
  });

  it("recusa política incompleta em vez de inventar prioridade", () => {
    expect(() => recommendCompanyPriority({ ...policy, riskMapping: { LOW: "P5" } } as never, "CRITICAL")).toThrow(
      "Política térmica sem prioridade válida para MODERATE",
    );
  });
});
