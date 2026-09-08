# Industrial Maintenance Intelligence (PCM + IA Preditiva)

Sistema de manutenção preditiva termográfica com análise obrigatória por IA e confirmação humana antes da autorização de uma OS.

> **Adequação GPMS 2026 — 08/09/2026:** Etapas 1–5 estruturalmente concluídas; Etapa 6 em validação; Etapa 7 concluída no escopo offline; e Etapa 8 implementada, aguardando apenas a carga/processamento autorizado no banco demonstrativo. O FastAPI executa um modelo térmico `SYNTHETIC_EXPERIMENTAL` verificável e não possui fallback por regras. Veja o [prompt executado da Etapa 8](docs/prompts/etapa-8-treinamento-integracao-fastapi.md) e o [registro técnico](docs/architecture.md#modelo-termográfico-e-fastapi-obrigatório-gpms-2026--adequação-etapa-8).

## Propósito

Permitir o ciclo `ThermalReading → IA → Prediction → incidente → revisão humana → OS`. Cadastros e consulta/execução de manutenção permanecem acessíveis; o dashboard mecânico e sua conversão direta de alertas foram desativados. As seções históricas abaixo documentam a base anterior; o roteiro vigente está em `Adequaçoes.md`.

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
├── datasets/                   # séries, janelas, cenário reservado, metadados e relatórios
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

# Os artefatos mecânicos antigos são preservados como histórico.
# O modelo térmico real será integrado na Etapa 8; DEMO não habilita o fluxo térmico.

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

## Dataset termográfico temporal (Etapa 7)

O dataset é sintético e serve para desenvolvimento experimental; ele não comprova eficácia industrial. Para regenerar séries, splits, gráficos, avaliação de vazamento, manifesto e hashes com um único comando:

```bash
cd services/predictive-ai
python -m training.run_thermal_dataset_pipeline
```

O pipeline usa intervalo de 30 minutos, horizonte primário de 24 horas e secundário de 7 dias. Os splits de treino, validação e teste usam períodos e painéis mutuamente exclusivos; o cenário GPMS de 55 pontos, 19 anormais e o caso TP-039 fica separado. O teste final não participa da comparação offline entre regra e regressão logística.

O carregador valida o manifesto, omite `ground truth` e usa a ingestão real do Next.js. Ele é somente leitura por padrão:

```bash
cd apps/web
pnpm thermal:load-reserved -- --allow-existing       # dry-run
pnpm thermal:load-reserved -- --apply --allow-existing # escrita explícita também sobre o cenário demonstrativo existente
```

O pós-ação permanece reservado, salvo se `--include-post-action` for informado. Na Etapa 8, `--apply --allow-existing` permite completar o cenário demonstrativo existente sem apagar dados; revise antes o dry-run e use uma conexão de banco configurada explicitamente.

## Modelo termográfico e FastAPI (Etapa 8)

O artefato não é baixado de serviço externo nem possui fallback. Em uma instalação limpa, gere e valide o bundle com:

```bash
cd services/predictive-ai
python -m training.train_thermal_models
python -m training.validate_model_artifact
```

O comando compara Logistic Regression, Random Forest e Gradient Boosting, calibra o vencedor, mantém Isolation Forest apenas como sinal complementar e abre o teste final depois de congelar a seleção. O `.joblib` é ignorado pelo Git e recuperado pelo build controlado; `models/metadata.json` registra checksum, fingerprint reproduzível, hashes dos dados e limitações.

Com o FastAPI rodando, valide o caminho HTTP real do gateway Next.js sem banco:

```bash
cd apps/web
pnpm thermal:verify-ai
```

Para carregar e processar uma leitura do cenário reservado pelo fluxo persistente real:

```bash
pnpm thermal:load-reserved -- --apply --allow-existing
pnpm thermal:verify-db-flow
```

O primeiro comando é uma carga pelo service de ingestão, não uma seed Prisma. O segundo usa fila, cálculo temporal, gateway, FastAPI, `Prediction` e consolidação de incidente. Ambos exigem configuração explícita do banco/serviço; a carga é dry-run quando `--apply` não é informado.

## Endpoints do serviço de IA

- `GET /health` e `GET /api/v1/health` — status do serviço e se há modelo real carregado.
- `GET /api/v1/thermal/health` — readiness do bundle térmico, versão, estágio, origem e checksum.
- `POST /api/v1/thermal/predict` — contrato temporal térmico estrito; requer `X-API-Key`.
- `POST /api/v1/predict` — fluxo mecânico legado desativado; responde `503` para entradas autenticadas.

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
