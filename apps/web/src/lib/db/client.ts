import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";
import { createNeonPoolConfig } from "@/lib/db/neon-pool-config";

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  neonPool?: Pool;
};
const configuredDatabaseUrl = process.env.DATABASE_URL;

function createPrismaClient(): PrismaClient {
  if (!configuredDatabaseUrl) {
    return new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  let pool = globalForPrisma.neonPool;
  if (!pool) {
    pool = new Pool(createNeonPoolConfig(configuredDatabaseUrl));
    // O Neon fecha conexões WebSocket ociosas do lado do servidor. Sem um
    // listener de "error" no Pool, essa desconexão vira uma exceção não
    // tratada ("Connection terminated unexpectedly") que derruba o processo
    // em vez de apenas ser substituída na próxima consulta pelo Prisma.
    pool.on("error", (err) => {
      console.error("[db] Conexão ociosa do pool Neon foi encerrada pelo servidor; será substituída na próxima consulta.", err);
    });
  }
  const adapter = new PrismaNeon(pool);

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.neonPool = pool;
  }

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
