# Industrial Maintenance Intelligence (PCM + IA Preditiva)

Sistema de manutenção preditiva termográfica com análise obrigatória por IA e confirmação humana antes da autorização de uma OS.

> **Adequação GPMS 2026 — 09/09/2026:** o caso demonstrativo TP-039 já percorreu leitura, inferência real, Prediction e incidente crítico; permanece fresco para a revisão humana e criação da OS durante a apresentação. O FastAPI executa um modelo `SYNTHETIC_EXPERIMENTAL` verificável, sem fallback por regras. `pnpm demo:verify` comprova as pré-condições sem escrever no banco. Veja o [prompt de prontidão consumido](docs/prompts/prontidao-demonstracao-e-deploy.md) e o [registro técnico](docs/architecture.md#prontidão-da-demonstração-empacotamento-e-automação-diária--09092026).

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
AI_SERVICE_URL="http://localhost:8000"                  # tem precedência
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

# Gere e valide o bundle térmico quando ele ainda não existir.
python -m training.train_thermal_models
python -m training.validate_model_artifact

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

## 7. Pré-voo da demonstração

Com FastAPI e banco acessíveis, execute na raiz:

```bash
pnpm demo:verify
```

O comando é somente leitura e deve retornar `status: "READY"`. Ele verifica readiness da IA, 55 pontos, 19 marcadores reservados, o caso TP-039 em 75,6 °C/ΔT 35,6 °C, proveniência da Prediction, vínculo com equipamento e um incidente ainda disponível para revisão humana e OS.

Para validar um build enquanto o servidor de ensaio estiver aberto, use `NEXT_DIST_DIR=.next-demo-build pnpm build` (PowerShell: `$env:NEXT_DIST_DIR='.next-demo-build'; pnpm build`). Isso mantém o cache de `next dev` intacto.

`AI_SERVICE_URL` tem precedência sobre `PREDICTIVE_AI_URL`. Se a porta 8000 estiver ocupada, suba o FastAPI em outra porta, ajuste as duas variáveis e reinicie o Next.js antes de rodar o pré-voo.

Roteiro recomendado: login como ADMIN/PLANNER → `/thermal-monitoring` → TP-039 → incidente crítico → mostrar inferência/versão/checksum → confirmar defeito → criar OS preditiva. A revisão e a OS são registros auditáveis: o cenário fresco é consumido uma vez e não é apagado automaticamente. Para ensaios repetidos, use uma branch/banco Neon demonstrativo separado e preserve o banco da apresentação.

Para preparar uma demonstração completa sem consumir primeiro todo o histórico,
acesse `/thermal-readings/simulator` e use **Simular planta e analisar agora**.
O fluxo grava 13 medições sintéticas para cada um dos 55 pontos, com degradação
térmica em 19, e envia as 55 leituras atuais ao artefato ML. Rótulos e causas
do gabarito não fazem parte do payload; o resultado mostra separadamente o
gabarito reservado e quantos riscos foram efetivamente detectados.

Fora do horário do cron, usuários autorizados podem usar **Sincronizar análises
agora** em `/thermal-monitoring`. A ação seleciona a leitura mais recente de
cada ponto ativo e analisa somente as que ainda estão pendentes, sem criar um
segundo agendamento. Ao encerrar a requisição não permanece nenhum worker em
background na Vercel; o histórico continua sob responsabilidade do cron diário.

## 8. Docker (serviço de IA)

```bash
docker compose up predictive-ai

# Ou construir explicitamente a partir da raiz do monorepo:
docker build -f services/predictive-ai/Dockerfile -t predictive-ai .
# Postgres local (opcional, alternativa ao Neon):
docker compose --profile local-db up postgres
```

O contexto é a raiz porque o build usa os datasets processados para treinar e validar `thermal_model.joblib`, que não é versionado. O build falha se o artefato/checksum não for válido, e o Compose usa o bundle interno da imagem sem sobrescrevê-lo com um volume local. O Next.js roda fora do Docker durante o desenvolvimento.

## 9. Deploy conjunto na Vercel

O `vercel.json` da raiz usa **Vercel Services** para publicar o Next.js e o
FastAPI no mesmo projeto e domínio:

- `web`: Next.js em `/`;
- `predictive_ai`: container gerado por `Dockerfile.vercel`;
- `/api/v1/*` e `/health`: tráfego público encaminhado ao FastAPI;
- demais rotas: encaminhadas ao Next.js;
- binding interno: injeta `PREDICTIVE_AI_INTERNAL_URL` no serviço `web`, sempre
  apontando para o backend da mesma Preview/Production. Essa variável tem
  precedência sobre as URLs usadas somente no desenvolvimento local.

Na importação do GitHub, selecione **Services** e deixe o **Root Directory na
raiz do repositório** (vazio ou `.`), não em `apps/web`. Não cadastre
`PREDICTIVE_AI_INTERNAL_URL`, `AI_SERVICE_URL` nem `PREDICTIVE_AI_URL` no
painel: valores definidos pelo usuário sobrescrevem a descoberta automática.

Cadastre como secretos/variáveis do projeto: `DATABASE_URL`, `DIRECT_URL`,
`AUTH_SECRET`, `NEXTAUTH_URL`, `AI_SERVICE_API_KEY` e `CRON_SECRET`. A mesma
`AI_SERVICE_API_KEY` é recebida pelos dois serviços. As variáveis opcionais
`AI_REQUEST_TIMEOUT_MS` (padrão `30000`), `AI_MAX_RETRIES`, `EXPECTED_MODEL_STAGE`,
`EXPECTED_MODEL_CHECKSUM` e `CORS_ORIGINS` podem ser usadas para pinagem e
ajuste operacional; `APP_ENV=production` já é definido na imagem.

O container tem dois estágios: o primeiro treina e valida o bundle a partir
dos datasets versionados; o segundo contém somente o runtime e o modelo
aprovado. O deploy falha se artefato, metadados ou checksum forem inválidos.

O mesmo `vercel.json` registra somente `GET /api/cron/daily-maintenance`,
diariamente às 06:00 UTC. A chamada autenticada por `CRON_SECRET` executa uma
vez o scheduler de OS preventivas e um lote limitado do processamento térmico.
O lote prioriza as leituras mais recentes para atualizar primeiro o risco atual
dos pontos; o histórico pendente é drenado nas execuções seguintes.
Os endpoints específicos antigos continuam disponíveis para operação manual,
mas não são agendados pela Vercel.

Após o deploy, valide `GET /health`, `GET /api/v1/thermal/health`, login e a
execução manual autenticada de `/api/cron/daily-maintenance` antes de depender
do primeiro agendamento.

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

O contrato térmico separa quatro conceitos que não devem ser confundidos:
`supervisedFailureProbability` é a probabilidade calibrada do classificador;
`confidence` é a confiança da classe supervisionada escolhida; `modelScore` é
o score combinado dos modelos; e `riskScore` é o score operacional final, que
pode ser elevado por um piso de engenharia somente após inferência ML válida.
Na interface, o modo de falha é apresentado como hipótese para revisão humana.

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

- Relatórios térmicos completos de incidente, painel, antes/depois e feedback da intervenção (Etapa 10).
- Telemetria física autenticada, reconexão e teste de carga dos dispositivos (Etapa 9).
- E2E versionado em navegador, hardening e performance para piloto controlado (Etapa 11).
- Mais cobertura de testes: services que dependem do Prisma Client (ex.: `work-order.service.ts`, `alert.service.ts`) ainda não têm testes de integração — hoje cobrimos as regras de negócio puras (atraso, permissões, máquina de estados, validação de schemas). Recomenda-se testes de integração com um banco de teste depois que `prisma generate` rodar.

## Documentação adicional

- [`docs/architecture.md`](docs/architecture.md) — arquitetura detalhada e decisões técnicas tomadas.
- [`docs/predictive-maintenance.md`](docs/predictive-maintenance.md) — fluxo `SensorReading → Prediction → Alert → WorkOrder`.
