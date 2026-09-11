import { describe, expect, it } from "vitest";
import { createNeonPoolConfig } from "./neon-pool-config";

describe("createNeonPoolConfig", () => {
  it("aplica limites conservadores sem remover opções do Neon", () => {
    const config = createNeonPoolConfig(
        "postgresql://user:secret@example.neon.tech/db?sslmode=require&channel_binding=require",
        {},
      );
    const result = new URL(config.connectionString);

    expect(result.searchParams.get("sslmode")).toBe("require");
    expect(result.searchParams.get("channel_binding")).toBe("require");
    expect(config.max).toBe(5);
    expect(config.connectionTimeoutMillis).toBe(10_000);
  });

  it("preserva parâmetros explícitos da DATABASE_URL", () => {
    const config = createNeonPoolConfig(
        "postgresql://user:secret@example.test/db?connection_limit=2&pool_timeout=7&connect_timeout=3",
        {
          DATABASE_CONNECTION_LIMIT: "9",
          DATABASE_POOL_TIMEOUT_SECONDS: "40",
          DATABASE_CONNECT_TIMEOUT_SECONDS: "12",
        },
      );
    const result = new URL(config.connectionString);

    expect(config.max).toBe(2);
    expect(config.connectionTimeoutMillis).toBe(3_000);
    expect(result.searchParams.has("connection_limit")).toBe(false);
    expect(result.searchParams.has("pool_timeout")).toBe(false);
    expect(result.searchParams.has("connect_timeout")).toBe(false);
  });

  it("aceita limites configurados e ignora valores inválidos", () => {
    const config = createNeonPoolConfig("postgresql://user:secret@example.test/db", {
        DATABASE_CONNECTION_LIMIT: "3",
        DATABASE_CONNECT_TIMEOUT_SECONDS: "0",
      });

    expect(config.max).toBe(3);
    expect(config.connectionTimeoutMillis).toBe(10_000);
  });
});
