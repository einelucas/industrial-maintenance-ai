import { z } from "zod";

export const sensorReadingSchema = z.object({
  equipmentId: z.string().uuid(),
  temperature: z.coerce.number().optional(),
  vibration: z.coerce.number().optional(),
  pressure: z.coerce.number().optional(),
  rpm: z.coerce.number().optional(),
  current: z.coerce.number().optional(),
  torque: z.coerce.number().optional(),
  operatingHours: z.coerce.number().optional(),
  // Campos do dataset AI4I 2020, espelhando prediction_input.py do FastAPI.
  airTemperature: z.coerce.number().optional(),
  processTemperature: z.coerce.number().optional(),
  toolWear: z.coerce.number().optional(),
  rotationalSpeed: z.coerce.number().optional(),
  source: z.enum(["MANUAL", "CSV", "SIMULATOR", "SENSOR"]).default("MANUAL"),
});

export type SensorReadingInput = z.infer<typeof sensorReadingSchema>;

export type SimulatorProfile = "NORMAL" | "ATTENTION" | "CRITICAL";
