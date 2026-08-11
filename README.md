# Industrial Maintenance Intelligence (PCM + IA Preditiva)

Sistema de Planejamento e Controle da Manutenção Industrial com suporte a Inteligência Artificial para manutenção preditiva.

## Propósito

Permitir o ciclo completo de PCM (cadastro de equipamentos, ordens de serviço, planos preventivos) combinado com um serviço de IA que calcula risco de falha a partir de leituras de sensores, gera alertas e permite que um planejador transforme um alerta em uma ordem de serviço preditiva.

## Arquitetura (resumo — detalhes em `docs/architecture.md`)

- **`apps/web`** — Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL (Neon). Única aplicação com acesso ao banco.
- **`services/predictive-ai`** — Python + FastAPI, stateless, dedicado à inferência de ML. Nunca escreve no banco.
- Fluxo: `Browser → Next.js → FastAPI → Next.js → PostgreSQL`.

## Stack

Next.js · React · TypeScript · Tailwind CSS · componentes estilo shadcn/ui · React Hook Form · Zod · Prisma · PostgreSQL (Neon) · Auth.js (NextAuth v5) · Recharts · date-fns · FastAPI · Pydantic · scikit-learn · pandas · joblib

## Estrutura

```
industrial-maintenance-ai/
├── apps/
│   └── web/                    # Next.js
│       ├── prisma/             # schema.prisma + seed.ts
│       └── src/
│           ├── app/            # rotas (App Router)
│           ├── features/       # schema → repository → service → actions → components
│           ├── components/     # UI e layout compartilhados
│           └── lib/             # auth, db, permissions, errors, utils
├── services/
│   └── predictive-ai/          # FastAPI
│       ├── app/                # api, core, schemas, ml
│       ├── training/           # scripts de treino (separados da inferência)
│       ├── models/             # model.joblib + metadata.json
│       └── tests/
├── datasets/                   # raw/processed (dataset sintético gerado por training/prepare_dataset.py)
├── docs/                       # architecture.md, predictive-maintenance.md
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Pré-requisitos

- Node.js 20+, pnpm 9+
- Python 3.12+
- Uma conta no [Neon](https://neon.tech) (Postgres serverless) — ou qualquer Postgres 15+

## 1. Banco de dados (Neon)

1. Crie um projeto no Neon e copie as duas connection strings do dashboard:
   - **Pooled connection** (para runtime) → `DATABASE_URL`
   - **Direct connection** (para migrations) → `DIRECT_URL`
2. Ambas devem terminar com `?sslmode=require`.

## 2. Instalação

```bash
# Na raiz do monorepo
pnpm install

# Configurar variáveis de ambiente
cp apps/web/.env.example apps/web/.env
cp services/predictive-ai/.env.example services/predictive-ai/.env
```

Edite `apps/web/.env`:
```
DATABASE_URL="postgresql://.../pcm?sslmode=require"        # pooled
DIRECT_URL="postgresql://.../pcm?sslmode=require"           # direct
AUTH_SECRET="<gere com: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
PREDICTIVE_AI_URL="http://localhost:8000"
AI_SERVICE_API_KEY="uma-chave-qualquer-compartilhada"
```

Edite `services/predictive-ai/.env` — `AI_SERVICE_API_KEY` deve ser **idêntica** à do `apps/web/.env`.

## 3. Banco: migrations + seed

```bash
cd apps/web
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

> ⚠️ Se você abrir/rodar este projeto num ambiente com acesso de rede restrito (sem acesso a `binaries.prisma.sh`), `prisma generate`/`migrate` falham ao baixar o engine binário. Rode esses comandos em um ambiente com internet normal (sua máquina local, CI, etc.).

## 4. Rodar o serviço de IA (FastAPI)

```bash
cd services/predictive-ai
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# (opcional) treinar um modelo real — sem isso, roda em modo DEMO automaticamente
python -m training.prepare_dataset
python -m training.train

uvicorn app.main:app --reload --port 8000
```

Verifique: `curl http://localhost:8000/health`

## 5. Rodar o Next.js

```bash
cd apps/web
pnpm dev
```

Acesse **http://localhost:3000** — você será redirecionado para `/login`.

## 6. Usuários de demonstração (criados pelo seed)

| Papel | E-mail | Senha |
|---|---|---|
| ADMIN | admin@pcm.local | admin123 |
| PLANNER | planejador@pcm.local | planner123 |
| TECHNICIAN | tecnico@pcm.local | tecnico123 |
| MANAGER | gestor@pcm.local | gestor123 |

## 7. Docker (opcional, apenas o serviço de IA)

```bash
docker compose up predictive-ai
# Postgres local (opcional, alternativa ao Neon):
docker compose --profile local-db up postgres
```

O Next.js roda fora do Docker durante o desenvolvimento, conforme especificado no escopo do projeto.

## Testes

```bash
# FastAPI
cd services/predictive-ai && source .venv/bin/activate && python -m pytest tests/ -v

# Next.js — testes unitários (regras de negócio: atraso, permissões, transições de OS, validação)
cd apps/web && pnpm test

# Next.js — lint e typecheck
cd apps/web && pnpm lint && pnpm typecheck
```

## Endpoints do serviço de IA

- `GET /health` e `GET /api/v1/health` — status do serviço e se há modelo real carregado.
- `POST /api/v1/predict` — requer header `X-API-Key`. Corpo: `{ equipmentId, temperature?, vibration?, pressure?, rpm?, current?, torque?, operatingHours? }`.

## Fluxos ponta-a-ponta já funcionais (seção 48 do escopo original)

1. Login com usuário seed ✅
2. Dashboard com cards e gráficos reais ✅
3. Listar/cadastrar equipamentos ✅
4. Detalhe do equipamento (6 abas) ✅
5. Criar/listar ordens de serviço, alterar status (transacional) ✅
6. Planos preventivos + "Gerar OS" ✅
7. Registrar/simular medição → enviar ao FastAPI → salvar Prediction → visualizar risco ✅
8. Alert gerado automaticamente quando risco ≥ MODERATE ✅
9. Dashboard preditivo com ranking de risco ✅
10. Transformar Alert em OS PREDICTIVE ✅
11. Cronograma com filtros por período, setor, responsável, status e tipo ✅

## Recursos pendentes (próximas fases)

- Geração de PDF real dos relatórios (`@react-pdf/renderer`) — estrutura e navegação já prontas em `/reports`.
- Scheduler automático para geração de OS preventivas (hoje é manual, por decisão explícita do escopo).
- Faixas de risco configuráveis via UI (hoje centralizadas em código, conforme escopo permite para a v1).
- Mais cobertura de testes: services que dependem do Prisma Client (ex.: `work-order.service.ts`, `alert.service.ts`) ainda não têm testes de integração — hoje cobrimos as regras de negócio puras (atraso, permissões, máquina de estados, validação de schemas). Recomenda-se testes de integração com um banco de teste depois que `prisma generate` rodar.

## Documentação adicional

- [`docs/architecture.md`](docs/architecture.md) — arquitetura detalhada e decisões técnicas tomadas.
- [`docs/predictive-maintenance.md`](docs/predictive-maintenance.md) — fluxo `SensorReading → Prediction → Alert → WorkOrder`.
