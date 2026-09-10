import type { CompanyThermalPriority, RiskLevel, ThermalPriorityPolicy } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ValidationError } from "@/lib/errors";
import { DEMO_PRIORITY_POLICY_VERSION } from "@/features/thermal-priority/constants";
export { COMPANY_PRIORITY_LABELS, DEMO_PRIORITY_POLICY_VERSION } from "@/features/thermal-priority/constants";

export const DEMO_PRIORITY_DEFINITIONS = {
  P5: { action: "INTENSIFY_MONITORING", label: "Intensificar monitoramento", companyValidated: true },
  P10: { action: "PLANNED_SHUTDOWN", label: "Intervir em parada programada", companyValidated: true },
  P20: { action: "INTERVENE_WITHIN_30_DAYS", label: "Intervir em até 30 dias", companyValidated: true },
  P30: { action: null, label: "Definição empresarial pendente", companyValidated: false },
  P50: { action: null, label: "Definição empresarial pendente", companyValidated: false },
  P100: { action: null, label: "Definição empresarial pendente", companyValidated: false },
} as const;

// Mapeamento demonstrativo explícito, não alegado como política oficial da
// empresa. Preserva o caso crítico informado (P20) e só utiliza níveis cujo
// significado foi fornecido no desafio.
export const DEMO_RISK_TO_COMPANY_PRIORITY: Record<RiskLevel, CompanyThermalPriority> = {
  LOW: "P5",
  MODERATE: "P10",
  HIGH: "P20",
  CRITICAL: "P20",
};

type PolicyLike = Pick<ThermalPriorityPolicy, "version" | "status" | "riskMapping">;

function parseRiskMapping(value: unknown): Record<RiskLevel, CompanyThermalPriority> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Política térmica sem mapeamento de risco válido.");
  }
  const raw = value as Record<string, unknown>;
  const allowed = new Set<CompanyThermalPriority>(["P5", "P10", "P20", "P30", "P50", "P100"]);
  const result = {} as Record<RiskLevel, CompanyThermalPriority>;
  for (const risk of ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const) {
    const priority = raw[risk];
    if (typeof priority !== "string" || !allowed.has(priority as CompanyThermalPriority)) {
      throw new ValidationError(`Política térmica sem prioridade válida para ${risk}.`);
    }
    result[risk] = priority as CompanyThermalPriority;
  }
  return result;
}

export function recommendCompanyPriority(policy: PolicyLike, risk: RiskLevel): CompanyThermalPriority {
  return parseRiskMapping(policy.riskMapping)[risk];
}

export const thermalPriorityPolicyService = {
  async getCurrent(): Promise<ThermalPriorityPolicy> {
    const validated = await prisma.thermalPriorityPolicy.findFirst({
      where: { status: "COMPANY_VALIDATED" },
      orderBy: { createdAt: "desc" },
    });
    if (validated) return validated;

    const draft = await prisma.thermalPriorityPolicy.findUnique({ where: { version: DEMO_PRIORITY_POLICY_VERSION } });
    if (!draft) throw new ValidationError("Política térmica demonstrativa não cadastrada.");
    return draft;
  },

  async recommend(risk: RiskLevel) {
    const policy = await this.getCurrent();
    return { priority: recommendCompanyPriority(policy, risk), policyVersion: policy.version, policyStatus: policy.status };
  },

  /**
   * Completa o contexto empresarial de predições antigas sem snapshot da
   * Etapa 9. O par prioridade/versão é indivisível: se um deles estiver
   * ausente, ambos são resolvidos pela política atual, sem alterar a
   * Prediction histórica.
   */
  async resolveForReview(input: {
    riskLevel: RiskLevel;
    recommendedCompanyPriority: CompanyThermalPriority | null;
    priorityPolicyVersion: string | null;
  }) {
    if (input.recommendedCompanyPriority && input.priorityPolicyVersion) {
      return {
        priority: input.recommendedCompanyPriority,
        policyVersion: input.priorityPolicyVersion,
        policyStatus: null,
      };
    }
    return this.recommend(input.riskLevel);
  },
};
