import { z } from "zod";

export const equipmentSchema = z.object({
  tag: z.string().min(2, "TAG é obrigatória."),
  name: z.string().min(2, "Nome é obrigatório."),
  description: z.string().optional(),
  category: z.string().min(2, "Categoria é obrigatória."),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  location: z.string().optional(),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.enum(["OPERATIONAL", "MAINTENANCE", "STOPPED", "INACTIVE"]),
  installationDate: z.string().optional(),
  sectorId: z.string().uuid("Selecione um setor válido."),
});

export type EquipmentInput = z.infer<typeof equipmentSchema>;
