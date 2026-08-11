import { z } from "zod";

// Espelha app/schemas/prediction_output.py do serviço FastAPI.
export const predictiveAiResponseSchema = z.object({
  failureProbability: z.number().min(0).max(1),
  riskLevel: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]),
  predictedClass: z.number().int(),
  modelVersion: z.string(),
  featuresUsed: z.array(z.string()),
  isDemoModel: z.boolean(),
});

export type PredictiveAiResponse = z.infer<typeof predictiveAiResponseSchema>;

export interface PredictiveAiInput {
  equipmentId: string;
  temperature?: number;
  vibration?: number;
  pressure?: number;
  rpm?: number;
  current?: number;
  torque?: number;
  operatingHours?: number;
  airTemperature?: number;
  processTemperature?: number;
  toolWear?: number;
  rotationalSpeed?: number;
}
