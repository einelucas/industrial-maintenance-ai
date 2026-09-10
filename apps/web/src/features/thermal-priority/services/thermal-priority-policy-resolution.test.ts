import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    thermalPriorityPolicy: {
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
    },
  },
}));

import { DEMO_PRIORITY_POLICY_VERSION } from "@/features/thermal-priority/constants";
import { DEMO_RISK_TO_COMPANY_PRIORITY, thermalPriorityPolicyService } from "./thermal-priority-policy.service";

describe("contexto de prioridade na revisão humana", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserva o snapshot completo de uma predição atual", async () => {
    await expect(thermalPriorityPolicyService.resolveForReview({
      riskLevel: "CRITICAL",
      recommendedCompanyPriority: "P20",
      priorityPolicyVersion: "policy-snapshot-v1",
    })).resolves.toEqual({ priority: "P20", policyVersion: "policy-snapshot-v1", policyStatus: null });

    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("aplica a política atual sem reescrever uma predição antiga", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.findUnique.mockResolvedValue({
      version: DEMO_PRIORITY_POLICY_VERSION,
      status: "DEMO_DRAFT",
      riskMapping: DEMO_RISK_TO_COMPANY_PRIORITY,
    });

    await expect(thermalPriorityPolicyService.resolveForReview({
      riskLevel: "MODERATE",
      recommendedCompanyPriority: null,
      priorityPolicyVersion: null,
    })).resolves.toEqual({
      priority: "P10",
      policyVersion: DEMO_PRIORITY_POLICY_VERSION,
      policyStatus: "DEMO_DRAFT",
    });
  });
});
