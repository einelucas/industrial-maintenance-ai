// Gerador pseudoaleatório determinístico (mulberry32) — nunca usa Math.random().
// Usado pelo simulador termográfico (Etapa 2 / GPMS 2026) para que duas execuções
// limpas do seed produzam exatamente o mesmo cenário.

export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deriva um seed determinístico a partir de um seed-base e uma chave textual (FNV-1a). */
export function hashSeed(base: number, key: string): number {
  let hash = (base ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < key.length; i++) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function rngRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Soma de 3 uniformes centrada em 0 — aproxima um ruído gaussiano limitado, sem depender de Math.random(). */
export function rngNoise(rng: Rng): number {
  return rng() + rng() + rng() - 1.5;
}

/** Fisher-Yates determinístico, usado para escolher os pontos originalmente anormais. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}
