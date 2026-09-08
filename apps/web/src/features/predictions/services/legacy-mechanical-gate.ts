import { ValidationError } from "@/lib/errors";

/** Mantém compatibilidade de actions antigas sem permitir a análise mecânica/demo. */
export function assertMechanicalWorkflowAvailable(): void {
  throw new ValidationError("Fluxo preditivo mecânico desativado. Registre leituras de um ponto termográfico em /thermal-readings.");
}
