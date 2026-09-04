import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Garante estaticamente que o manifesto de ground truth (arquivo JSON) e o
// escritor do seed (`seed-thermal-scenario.ts`) nunca são importados/citados
// pelo runtime da aplicação (rotas, actions, services, components) — apenas
// por `prisma/seed.ts`, pelo próprio módulo de simulação e pelos testes de
// integração dedicados em `src/lib/db/`.

const SRC_ROOT = path.resolve(__dirname, "../../");
// Diretórios cujo conteúdo tem permissão de referenciar o escritor do seed.
const ALLOWED_DIR_PREFIXES = [
  path.resolve(__dirname), // apps/web/src/lib/thermal-simulation — o próprio módulo
  path.resolve(__dirname, "..", "db"), // apps/web/src/lib/db — testes de integração dedicados
];
const FORBIDDEN_IMPORT_PATTERNS = [/thermal-simulation\/seed-thermal-scenario/, /reserved_plant_manifest/];

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("isolamento do manifesto de ground truth e do escritor do seed", () => {
  it("nenhum arquivo fora de lib/thermal-simulation e lib/db referencia o escritor do seed ou o manifesto", () => {
    const offenders: string[] = [];
    for (const file of collectFiles(SRC_ROOT)) {
      if (ALLOWED_DIR_PREFIXES.some((prefix) => file.startsWith(prefix + path.sep))) continue;
      const content = readFileSync(file, "utf-8");
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(content)) {
          offenders.push(`${path.relative(SRC_ROOT, file)} (padrão: ${pattern})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
