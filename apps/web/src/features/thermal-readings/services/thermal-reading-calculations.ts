// Cálculos derivados de uma leitura termográfica (GPMS 2026 / Etapa 4).
//
// Funções puras, sem I/O e sem acesso ao Prisma — recebem números já
// validados e devolvem números ou `null`. Nunca inferem risco, severidade,
// causa ou diagnóstico: são apenas features de entrada rastreáveis que a IA
// (Etapa 5+) poderá consumir depois. Nenhuma delas sobrescreve a leitura
// original — o chamador decide o que persistir e o que só devolver na
// resposta/consulta.

const ROUNDING_DECIMALS = 1;

/** Arredondamento centralizado de todo valor termográfico derivado — 1 casa decimal. */
export function roundThermalValue(value: number): number {
  const factor = 10 ** ROUNDING_DECIMALS;
  return Math.round(value * factor) / factor;
}

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * ΔT = temperatura máxima − temperatura de referência.
 *
 * A referência é opcional (nem todo ponto tem uma referência plausível
 * cadastrada): sua ausência devolve `null`, nunca `0` — zero significaria
 * "sem elevação detectada", uma afirmação analítica que este cálculo não
 * tem autoridade para fazer.
 */
export function calculateDeltaT(
  temperatureMaxC: number,
  referenceTemperatureC: number | null | undefined
): number | null {
  if (!isUsableNumber(temperatureMaxC) || !isUsableNumber(referenceTemperatureC)) return null;
  return roundThermalValue(temperatureMaxC - referenceTemperatureC);
}

/**
 * Elevação acima da temperatura ambiente = temperatura máxima − ambiente.
 *
 * Existe como feature de entrada complementar ao ΔT (que compara contra uma
 * referência fixa do ponto, não contra a condição ambiente do instante da
 * leitura). Hoje não há coluna própria no schema para persistir este valor
 * — ele é sempre recalculado em memória a partir de `temperatureMaxC` e
 * `ambientTemperatureC` já persistidos, tanto na ingestão quanto na
 * consulta de histórico.
 */
export function calculateRiseAboveAmbient(
  temperatureMaxC: number,
  ambientTemperatureC: number | null | undefined
): number | null {
  if (!isUsableNumber(temperatureMaxC) || !isUsableNumber(ambientTemperatureC)) return null;
  return roundThermalValue(temperatureMaxC - ambientTemperatureC);
}
