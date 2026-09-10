import { describe, expect, it } from "vitest";
import { withSafePrismaPoolLimits } from "./connection-url";

describe("withSafePrismaPoolLimits", () => {
  it("adiciona limites conservadores sem remover opções do Neon", () => {
    const result = new URL(
      withSafePrismaPoolLimits(
        "postgresql://user:secret@example.neon.tech/db?sslmode=require&channel_binding=require",
        {},
      ),
    );

    expect(result.searchParams.get("sslmode")).toBe("require");
    expect(result.searchParams.get("channel_binding")).toBe("require");
    expect(result.searchParams.get("connection_limit")).toBe("5");
    expect(result.searchParams.get("pool_timeout")).toBe("20");
    expect(result.searchParams.get("connect_timeout")).toBe("10");
  });

  it("preserva parâmetros explícitos da DATABASE_URL", () => {
    const result = new URL(
      withSafePrismaPoolLimits(
        "postgresql://user:secret@example.test/db?connection_limit=2&pool_timeout=7&connect_timeout=3",
        {
          DATABASE_CONNECTION_LIMIT: "9",
          DATABASE_POOL_TIMEOUT_SECONDS: "40",
          DATABASE_CONNECT_TIMEOUT_SECONDS: "12",
        },
      ),
    );

    expect(result.searchParams.get("connection_limit")).toBe("2");
    expect(result.searchParams.get("pool_timeout")).toBe("7");
    expect(result.searchParams.get("connect_timeout")).toBe("3");
  });

  it("aceita limites configurados e ignora valores inválidos", () => {
    const result = new URL(
      withSafePrismaPoolLimits("postgresql://user:secret@example.test/db", {
        DATABASE_CONNECTION_LIMIT: "3",
        DATABASE_POOL_TIMEOUT_SECONDS: "invalid",
        DATABASE_CONNECT_TIMEOUT_SECONDS: "0",
      }),
    );

    expect(result.searchParams.get("connection_limit")).toBe("3");
    expect(result.searchParams.get("pool_timeout")).toBe("20");
    expect(result.searchParams.get("connect_timeout")).toBe("10");
  });
});
