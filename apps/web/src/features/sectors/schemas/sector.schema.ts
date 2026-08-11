import { z } from "zod";

export const sectorSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres."),
  description: z.string().optional(),
});

export type SectorInput = z.infer<typeof sectorSchema>;
