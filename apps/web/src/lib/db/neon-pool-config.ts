const DEFAULT_CONNECTION_LIMIT = 5;
const DEFAULT_CONNECT_TIMEOUT_SECONDS = 10;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export interface NeonPoolConfig {
  connectionString: string;
  max: number;
  connectionTimeoutMillis: number;
}

/** Traduz os limites legados da URL do Prisma para o pool WebSocket do Neon. */
export function createNeonPoolConfig(
  rawUrl: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): NeonPoolConfig {
  try {
    const url = new URL(rawUrl);
    const max = positiveInteger(
      url.searchParams.get("connection_limit") ?? env.DATABASE_CONNECTION_LIMIT,
      DEFAULT_CONNECTION_LIMIT,
    );
    const connectTimeoutSeconds = positiveInteger(
      url.searchParams.get("connect_timeout") ?? env.DATABASE_CONNECT_TIMEOUT_SECONDS,
      DEFAULT_CONNECT_TIMEOUT_SECONDS,
    );

    // Esses parâmetros pertencem ao pool do engine Rust e seriam enviados ao
    // PostgreSQL como opções desconhecidas pelo driver JavaScript.
    url.searchParams.delete("connection_limit");
    url.searchParams.delete("pool_timeout");
    url.searchParams.delete("connect_timeout");

    return {
      connectionString: url.toString(),
      max,
      connectionTimeoutMillis: connectTimeoutSeconds * 1000,
    };
  } catch {
    return {
      connectionString: rawUrl,
      max: positiveInteger(env.DATABASE_CONNECTION_LIMIT, DEFAULT_CONNECTION_LIMIT),
      connectionTimeoutMillis:
        positiveInteger(env.DATABASE_CONNECT_TIMEOUT_SECONDS, DEFAULT_CONNECT_TIMEOUT_SECONDS) * 1000,
    };
  }
}
