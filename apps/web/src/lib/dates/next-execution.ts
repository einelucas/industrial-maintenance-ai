import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import type { FrequencyType } from "@prisma/client";

/**
 * Calcula a próxima data de execução de um plano preventivo a partir da
 * ÚLTIMA `nextExecution` (não de "agora") — mantém a cadência estável mesmo
 * se o scheduler atrasar para rodar (seção 18 do escopo).
 */
export function computeNextExecution(current: Date, frequencyType: FrequencyType, frequencyValue: number): Date {
  switch (frequencyType) {
    case "DAILY":
      return addDays(current, frequencyValue);
    case "WEEKLY":
      return addWeeks(current, frequencyValue);
    case "MONTHLY":
      return addMonths(current, frequencyValue);
    case "QUARTERLY":
      return addMonths(current, frequencyValue * 3);
    case "SEMIANNUAL":
      return addMonths(current, frequencyValue * 6);
    case "ANNUAL":
      return addYears(current, frequencyValue);
    case "CUSTOM_DAYS":
      return addDays(current, frequencyValue);
    default:
      return addDays(current, frequencyValue);
  }
}
