import { PrismaClient } from "@prisma/client";
import { withSafePrismaPoolLimits } from "@/lib/db/connection-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const configuredDatabaseUrl = process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(configuredDatabaseUrl
      ? { datasources: { db: { url: withSafePrismaPoolLimits(configuredDatabaseUrl) } } }
      : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
