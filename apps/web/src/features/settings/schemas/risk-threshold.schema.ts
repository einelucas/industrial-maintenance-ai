import { z } from "zod";

// Os campos do formulário são percentuais (1–98), não frações — mais
// natural para o usuário digitar "30" do que "0.3". O service converte
// para fração (0–1) antes de persistir, que é o formato usado no restante
// do sistema (Prediction.failureProbability, RiskLevel etc).
export const riskThresholdSchema = z.object({
  lowMax: z.coerce.number().min(1, "Deve ser maior que 0%.").max(98, "Deve ser menor que 98%."),
  moderateMax: z.coerce.number().min(1, "Deve ser maior que 0%.").max(98, "Deve ser menor que 98%."),
  highMax: z.coerce.number().min(1, "Deve ser maior que 0%.").max(98, "Deve ser menor que 98%."),
});

export type RiskThresholdInput = z.infer<typeof riskThresholdSchema>;
