import { riskThresholdRepository } from "@/features/settings/repositories/risk-threshold.repository";
import { riskThresholdSchema } from "@/features/settings/schemas/risk-threshold.schema";
import { ValidationError } from "@/lib/errors";

export const riskThresholdService = {
  get: () => riskThresholdRepository.getOrCreateDefault(),

  async update(input: unknown, updatedById: string) {
    const parsed = riskThresholdSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Faixas de risco inválidas.", parsed.error.flatten().fieldErrors);
    }

    const { lowMax, moderateMax, highMax } = parsed.data;
    if (!(lowMax < moderateMax && moderateMax < highMax)) {
      throw new ValidationError("Os cortes devem ser crescentes: baixo < moderado < alto.");
    }

    return riskThresholdRepository.update(
      { lowMax: lowMax / 100, moderateMax: moderateMax / 100, highMax: highMax / 100 },
      updatedById
    );
  },
};
