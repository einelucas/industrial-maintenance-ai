"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  thermalReadingSimulatorService,
  SIMULATOR_SCENARIOS,
  type RunSimulatorResult,
  type RunPlantDemoResult,
} from "@/features/thermal-readings/services/thermal-reading-simulator.service";
import { requirePermission } from "@/lib/auth/session";
import { toActionErrorMessage, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/db/client";
import { FEATURE_FLAGS } from "@/config/feature-flags";

export type RunThermalReadingSimulatorFormState = {
  error?: string;
  result?: RunSimulatorResult;
};

export type RunPlantDemoFormState = { error?: string; result?: RunPlantDemoResult };

export async function runPlantDemoAction(
  _prevState: RunPlantDemoFormState,
  _formData: FormData
): Promise<RunPlantDemoFormState> {
  try {
    if (!FEATURE_FLAGS.thermalSimulatorEnabled) throw new ValidationError("Simulador desabilitado neste ambiente.");
    const user = await requirePermission("thermal-reading:simulate");
    const result = await thermalReadingSimulatorService.runPlantDemo(new Date());
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "ThermalReading",
        entityId: "gpms-plant-demo-cycle",
        action: "SIMULATE_AND_ANALYZE_PLANT",
        metadata: JSON.parse(JSON.stringify(result)),
      },
    });
    revalidatePath("/thermal-readings");
    revalidatePath("/thermal-monitoring", "layout");
    revalidatePath("/thermal-incidents", "layout");
    return { result };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}

const runSimulatorFormSchema = z.object({
  thermalPointId: z.string().uuid("Selecione um ponto termográfico válido."),
  scenario: z.enum(SIMULATOR_SCENARIOS, { errorMap: () => ({ message: "Selecione um cenário válido." }) }),
  seed: z.coerce.number().int().nonnegative().default(1),
  sampleCount: z.coerce.number().int().positive().max(500),
  intervalMinutes: z.coerce.number().int().positive().default(15),
  referenceTemperatureC: z.coerce
    .number()
    .finite()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function runThermalReadingSimulatorAction(
  _prevState: RunThermalReadingSimulatorFormState,
  formData: FormData
): Promise<RunThermalReadingSimulatorFormState> {
  try {
    if (!FEATURE_FLAGS.thermalSimulatorEnabled) throw new ValidationError("Simulador desabilitado neste ambiente.");
    const user = await requirePermission("thermal-reading:simulate");

    const raw = Object.fromEntries(formData.entries());
    const parsed = runSimulatorFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Dados do simulador inválidos." };
    }

    // Única fronteira de I/O autorizada a ler o relógio real: o motor de
    // cenários (`reading-scenarios.ts`) e o service do simulador só recebem
    // `now` como parâmetro, nunca chamam `new Date()` internamente.
    const now = new Date();
    const result = await thermalReadingSimulatorService.run(parsed.data, now);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entity: "ThermalReading",
        entityId: "simulator-run",
        action: "SIMULATE",
        metadata: {
          scenario: result.scenario,
          thermalPointCode: result.thermalPointCode,
          seed: parsed.data.seed,
          totalGenerated: result.totalGenerated,
          acceptedCount: result.acceptedCount,
          rejectedCount: result.rejectedCount,
        },
      },
    });

    revalidatePath("/thermal-readings");
    revalidatePath("/thermal-monitoring", "layout");
    revalidatePath(`/thermal-points/${parsed.data.thermalPointId}`);
    return { result };
  } catch (error) {
    return { error: toActionErrorMessage(error) };
  }
}
