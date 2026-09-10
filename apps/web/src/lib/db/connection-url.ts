const DEFAULT_CONNECTION_LIMIT = 5;
const DEFAULT_POOL_TIMEOUT_SECONDS = 20;
const DEFAULT_CONNECT_TIMEOUT_SECONDS = 10;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Evita que cada processo Next.js abra o limite calculado pelo número de CPUs
 * (21 conexões nesta máquina). O endpoint pooled do Neon deve receber pools
 * pequenos por processo, especialmente durante hot reload e em serverless.
 *
 * Parâmetros já presentes na DATABASE_URL sempre têm precedência.
 */
export function withSafePrismaPoolLimits(
  rawUrl: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  try {
    const url = new URL(rawUrl);

    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set(
        "connection_limit",
        String(positiveInteger(env.DATABASE_CONNECTION_LIMIT, DEFAULT_CONNECTION_LIMIT)),
      );
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set(
        "pool_timeout",
        String(positiveInteger(env.DATABASE_POOL_TIMEOUT_SECONDS, DEFAULT_POOL_TIMEOUT_SECONDS)),
      );
    }
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set(
        "connect_timeout",
        String(positiveInteger(env.DATABASE_CONNECT_TIMEOUT_SECONDS, DEFAULT_CONNECT_TIMEOUT_SECONDS)),
      );
    }

    return url.toString();
  } catch {
    // O Prisma continuará responsável por emitir o erro útil de URL inválida.
    return rawUrl;
  }
}
