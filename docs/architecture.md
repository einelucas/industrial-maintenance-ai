# Arquitetura — Industrial Maintenance Intelligence

## Visão geral

Sistema híbrido com dois processos independentes:

```
Browser
  │
  ▼
Next.js (apps/web)  ──HTTP interno (X-API-Key)──▶  FastAPI (services/predictive-ai)
  │                                                        │
  ▼                                                        ▼
PostgreSQL (Neon)                                   modelo .joblib (ou DemoPredictor)
```

- **Next.js é o único componente com acesso ao PostgreSQL.** O FastAPI é stateless e nunca escreve nas tabelas operacionais — apenas recebe features e devolve uma predição.
- **Fluxo de dados:** `Next.js → FastAPI → modelo ML → FastAPI response → Next.js → PostgreSQL`.
- **Segurança:** o browser nunca chama o FastAPI diretamente. Toda chamada passa por uma Server Action/Route Handler do Next.js, que injeta o header `X-API-Key` (valor de `AI_SERVICE_API_KEY`, nunca exposto com `NEXT_PUBLIC_`).

## Camadas do Next.js

```
UI (Server/Client Components)
  → Action/Controller (Server Actions em features/*/actions)
  → Schema (Zod, em features/*/schemas)
  → Service (regra de negócio, em features/*/services)
  → Repository (consultas Prisma, em features/*/repositories)
  → Prisma
  → PostgreSQL
```

Regras:
- Componentes React **nunca** importam o Prisma Client diretamente.
- Toda regra de negócio (transições de status, cálculo de atraso, permissões, geração de numeração de OS) vive em `services/`, nunca duplicada em componentes.
- Toda entrada de usuário passa por um schema Zod antes de chegar ao service.

## Monólito modular

`apps/web/src/features/*` — cada feature é auto-contida (schema, repository, service, actions, components) e só se comunica com outras features através de repositories/services exportados, nunca acessando internals de outra feature diretamente.

## Decisões técnicas tomadas (não especificadas explicitamente no escopo)

Estas decisões foram tomadas para permitir uma primeira entrega funcional, seguindo a instrução de "tomar uma decisão tecnicamente coerente e documentá-la":

1. **Critério de geração de Alert a partir de uma Prediction:** um `Alert` é criado quando `riskLevel` é `MODERATE`, `HIGH` ou `CRITICAL`. `LOW` não gera alerta (fica apenas no histórico de Predictions). Centralizado em `features/predictions/services/prediction.service.ts`.
2. **Transições de status de OS:** modeladas como uma máquina de estados explícita em `features/work-orders/schemas/work-order.schema.ts` (`VALID_TRANSITIONS`), evitando saltos inválidos (ex: `CANCELED → IN_PROGRESS`).
3. **Numeração de OS:** formato `OS-<ano>-<sequencial 4 dígitos>` (ex: `OS-2026-0001`), calculado por contagem de OS do ano corrente. Para alta concorrência em produção, evoluir para uma sequence do Postgres.
4. **Componentes de UI:** implementados manualmentes no padrão shadcn/ui (Button, Card, Badge, Input, Select, Table, Tabs) em vez de rodar o CLI do shadcn, pois o ambiente de construção não tinha acesso irrestrito à internet. São incrementalmente substituíveis pelos componentes oficiais do shadcn/ui a qualquer momento — a API é compatível.
5. **Autenticação:** Auth.js (NextAuth v5 beta) com provider `Credentials` + estratégia JWT (sem tabela de sessão no banco), mais simples para a primeira versão. O `PrismaAdapter` (`@auth/prisma-adapter`) está instalado e pronto para uma eventual migração para sessões em banco/OAuth.
6. **Cronograma (`/schedule`):** implementado como uma visão somente-leitura tipo Gantt simplificada (barras horizontais proporcionais ao período de cada OS), sem biblioteca de Gantt de terceiros. Filtros de período/setor/responsável/status/tipo (seção 27 do escopo) ficam como próxima iteração.
7. **Relatórios (`/reports`):** a navegação e a estrutura (6 tipos de relatório) estão prontas; a geração de PDF com `@react-pdf/renderer` fica para a próxima fase, conforme permitido explicitamente pelo escopo ("não é necessário implementar todos os relatórios na primeira entrega").

## Integração Next.js ↔ FastAPI

Client centralizado em `apps/web/src/features/predictions/services/predictive-ai.client.ts`:
- `healthCheck()` — usado para diagnósticos.
- `predictFailure(input)` — chama `POST /api/v1/predict` com timeout de 8s e tratamento de erro via `IntegrationError`.
- Nunca inventa uma predição quando o serviço está fora do ar — o erro é propagado para a UI, que informa que o serviço preditivo está indisponível, sem impedir o uso do restante do PCM.

## Banco de dados (Neon)

- `DATABASE_URL`: connection string **pooled** do Neon — usada em runtime pela aplicação.
- `DIRECT_URL`: connection string **direta** (sem pooler) — usada apenas por `prisma migrate`.
- Migrations versionadas via `prisma migrate dev` / `prisma migrate deploy`. Nunca usar `prisma db push` como estratégia normal.

## Limitação conhecida deste ambiente de construção

O sandbox usado para gerar este projeto tem acesso de rede restrito a uma allowlist de domínios que **não inclui `binaries.prisma.sh`**, de onde o Prisma baixa o engine binário nativo. Por isso, `npx prisma generate` e `npx prisma migrate dev` não puderam ser executados aqui. O schema foi validado manualmente e o restante do código foi checado com `tsc --noEmit` e `eslint` — os únicos erros restantes de TypeScript são todos cascata direta da ausência do Prisma Client gerado (tipos como `Prisma.WorkOrderCreateInput` não existem até `generate` rodar). Rodando `pnpm install && npx prisma generate` na sua máquina (com internet irrestrita), esses erros desaparecem.
