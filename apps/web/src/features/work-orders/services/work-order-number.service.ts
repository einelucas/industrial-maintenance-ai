import { prisma } from "@/lib/db/client";

/**
 * Gera numeração amigável para OS: OS-<ano>-<sequencial 4 dígitos>.
 * Centralizado aqui para nunca expor UUID como número visível ao usuário
 * (seção 15 do escopo).
 */
export async function generateWorkOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OS-${year}-`;

  const count = await prisma.workOrder.count({
    where: { number: { startsWith: prefix } },
  });

  const sequence = String(count + 1).padStart(4, "0");
  return `${prefix}${sequence}`;
}
