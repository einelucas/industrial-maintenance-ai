# Checklist — Pendências e Otimizações

> Última revisão: itens marcados `[x]` foram implementados e verificados
> (typecheck/lint/test + teste manual via navegador real, quando aplicável).
> Itens `[ ]` continuam pendentes. Onde um item foi parcialmente resolvido,
> isso está explicado no próprio texto em vez de marcado como concluído.

## 🔴 Bloqueadores para produção (fazer antes de qualquer deploy real)

- [x] ~~Rodar `npx prisma generate` + `npx prisma migrate dev`~~ — feito repetidas vezes com sucesso (internet confirmada disponível no ambiente). **Atenção:** `prisma migrate dev` falha neste projeto com um erro do Neon (`P1001` / "terminating connection due to administrator command") ao criar o shadow database — é uma limitação conhecida do Neon com múltiplos databases no mesmo branch, não falta de internet. Workaround usado em todas as migrations desta fase: `prisma db push` (aplica o schema direto) + arquivo de migration escrito manualmente + `prisma migrate resolve --applied` (mantém o histórico de migrations consistente). Documentar esse processo formalmente é o item que falta (ver seção DevOps).
- [ ] Trocar `AUTH_SECRET`, `AI_SERVICE_API_KEY` **e `CRON_SECRET`** (novo — usado pelo scheduler automático de OS preventivas) de desenvolvimento por valores fortes e únicos em produção
- [ ] Configurar `NEXTAUTH_URL` com o domínio real de produção
- [ ] Revisar CORS do FastAPI (`CORS_ORIGINS`) caso o endpoint público seja consumido diretamente pelo navegador; a aplicação usa binding interno server-to-server
- [x] Definir estratégia de deploy do FastAPI — Vercel Services, em container descrito por `Dockerfile.vercel`
- [x] Garantir que o build do FastAPI recupere o modelo ignorado pelo Git — a imagem Vercel usa a raiz, treina e valida o bundle/checksum em estágio isolado
- [x] Definir estratégia de deploy do Next.js — serviço `web` no mesmo projeto Vercel, com um único cron diário
- [x] Conectar Next.js e FastAPI sem hostname público fixo — binding Vercel deployment-aware e autenticação por `AI_SERVICE_API_KEY`
- [x] Projeto versionado em Git, branch `main`, com remoto `origin` configurado
- [x] Pré-voo somente leitura `pnpm demo:verify` valida IA, banco, TP-039 e estado fresco do roteiro antes da apresentação
- [x] Consolidar automações Vercel em uma única execução diária autenticada

## 🟣 Machine Learning — dataset e modelo (novo desde a última revisão)

- [x] Corrigida inconsistência de schema: `SensorReading` no Prisma não tinha `airTemperature`, `processTemperature`, `toolWear`, `rotationalSpeed`, que o FastAPI (`prediction_input.py`) já esperava — campos adicionados, propagados por schema Zod, formulário manual, repository, service, simulador e `predictive-ai.client.ts`
- [x] `training/prepare_dataset.py` reescrito com base em fontes reais citadas (AI4I 2020 Predictive Maintenance Dataset + ISO 10816-3 para vibração), documentado no topo do arquivo, incluindo as duas decisões de calibração que se afastam do texto literal do AI4I (e por quê — random walk vira Normal i.i.d. por linha; potência de referência recalibrada de 2860W para ~6250W)
- [x] Pipeline de treino rodado de verdade: **Gradient Boosting** venceu (F1=0,689, ROC-AUC=0,993, precision=0,546, recall=0,933), `models/model.joblib`/`metadata.json` gerados, `/health` confirma `predictorType: "sklearn"`
- [x] `GradientBoostingClassifier` não aceita `class_weight` (ao contrário de LogisticRegression/RandomForest) — balanceamento de classes aplicado via `sample_weight` no `.fit()`
- [ ] Taxa de falha do dataset sintético ficou em **3,58%** (alvo do AI4I original: ~3,4%) — próximo, mas não idêntico; revisar se vale a pena recalibrar ainda mais os parâmetros de geração (`power_reference`, escala do `tool_wear`) ou se essa margem é aceitável
- [ ] Tabela de medições na página do equipamento não exibe os 4 campos novos (`airTemperature`, `processTemperature`, `toolWear`, `rotationalSpeed`) — só o formulário manual e o simulador os usam
- [ ] Import de CSV de leituras não inclui os 4 campos novos no schema da linha (`sensor-reading-csv-row.schema.ts`) — CSVs históricos não conseguem trazer esses dados ainda
- [ ] Campo `torque` nunca teve input no formulário manual de medição (existe no schema/repositório desde antes, gap pré-existente não relacionado às mudanças recentes)

## 🔵 Loop de aprendizado com dados reais (feedback loop) — hoje o modelo só treina com dados sintéticos

- [x] Modelo `FailureEvent` no Prisma (`equipmentId`, `occurredAt`, `description?`, `workOrderId?`, `createdById`, `createdAt`) + feature completa (`schemas/repositories/services/actions/components`) seguindo o padrão do resto do projeto
- [x] Botão **"Registrar falha real"** na página de detalhe do equipamento (aba "Falhas reais", com formulário + histórico)
- [ ] Gatilho **ao concluir uma OS `CORRECTIVE`** (a segunda metade do item original — só a versão manual na página do equipamento foi feita)
- [ ] Script `training/build_dataset_from_production.py`: cruza `SensorReading` histórico + `FailureEvent` (janela de tempo, ex: 7 dias antes da falha = `failure=1`) para gerar um dataset real em `datasets/processed/`
- [ ] Endpoint/rotina de exportação desse histórico do Next.js (o Postgres operacional não deve ser acessado direto pelo script Python, mesma regra de separação já usada no resto do projeto)
- [ ] Retreinar `training/train.py` apontando pro dataset real em vez do sintético (`prepare_dataset.py`) — `DATASET_PATH` está fixo no arquivo hoje, precisa virar parâmetro
- [ ] Processo (manual no início, depois automatizável) de comparar métricas do modelo novo vs. modelo em produção antes de promover — nunca substituir automaticamente por um modelo pior
- [ ] Definir a janela de tempo "leitura → falha" com o time de manutenção (7 dias é só um ponto de partida, depende do tipo de equipamento) — decisão de negócio, não técnica
- [ ] **[NOVO]** `FailureEvent.workOrderId` não valida que a OS relacionada pertence ao mesmo equipamento — hoje é possível (por engano, via UI) vincular a falha de um equipamento a uma OS de outro
- [ ] **[NOVO]** Hoje não há praticamente nenhum `FailureEvent` real no banco (a funcionalidade acabou de ser implementada) — mesmo depois de todo o resto deste bloco pronto, o retreino só terá valor real depois de volume acumulado em produção

## 🟢 UI/UX (novo desde a última revisão — praticamente tudo do backlog de UI foi implementado)

- [x] Componentes `button`/`input`/`label`/`card`/`badge` reescritos no padrão oficial shadcn/ui, preservando as variantes customizadas do projeto (`neutral/attention/high/critical` do Badge, `outline/ghost/destructive` do Button)
- [x] Dark mode completo: `next-themes`, toggle no header, paleta escura para os 20 tokens de cor (base + status)
- [x] Loading states (`Skeleton` + `loading.tsx`) em dashboard, equipamentos, OS, alertas, planos preventivos, usuários + fallback genérico
- [x] Error boundaries (`error.tsx` no grupo autenticado, na raiz, e `global-error.tsx`)
- [x] Paginação + busca/filtro em `/equipments`, `/work-orders`, `/alerts`
- [x] Modal de confirmação antes de cancelar uma OS (`ConfirmDialog` reutilizável)
- [x] Responsividade mobile das tabelas mais carregadas (colunas secundárias ocultas em telas pequenas)
- [x] Edição de equipamentos e planos preventivos (formulário de criação virou create/edit)
- [x] Paginação/busca em `/maintenance-plans` (nome do plano ou TAG do equipamento + filtro de frequência) e `/users` (nome/e-mail + filtro de perfil/status) — mesmo padrão de `findFiltered`/`Pagination` das outras três listagens
- [x] `dropdown-menu`/`tabs` oficiais do shadcn/ui adicionados (`components/ui/tabs.tsx`, `components/ui/dropdown-menu.tsx`, ambos via `@radix-ui`). O `Tabs` customizado foi **removido** — a página de detalhe do equipamento migrou para a API composable (`Tabs/TabsList/TabsTrigger/TabsContent`). O `dropdown-menu` foi aplicado no menu do usuário no header (nome/perfil vira um dropdown com "Minha conta" e "Sair", no lugar do botão de logout solto)
- [x] Checklist de itens do plano preventivo agora é editável via UI (criação **e** edição) — editor dinâmico de itens (adicionar/remover) em `plan-form.tsx`; `create-plan.action.ts`/`update-plan.action.ts` corrigidos para coletar múltiplos valores do campo `checklistItems` via `formData.getAll()` (o `Object.fromEntries()` usado em outras actions só mantém o último valor de campos repetidos — só funcionava por acidente até agora, ninguém tinha campos de múltiplo valor). Na edição, o checklist é apagado e recriado a cada save (seguro: a OS gerada sempre leva uma cópia congelada, não referencia o plano)
- [x] Fluxo de redefinição de senha implementado dos dois lados: admin redefine a senha de qualquer usuário na tela de edição (`/users/[id]`, sem exigir a senha atual) e o próprio usuário troca a sua em uma página nova (`/account`, exige a senha atual via `bcrypt.compare`), acessível pelo novo menu dropdown do header

## 🟡 Testes — cobertura incompleta

- [x] Regras de atraso de OS (`isWorkOrderDelayed`) — 6 testes
- [x] Permissões/policies (`can`, `assertCan`, `canOperateWorkOrder`) — 9 testes
- [x] Máquina de estados de transição de OS — 12 testes
- [x] Validação de schemas (equipment, sensor-reading) — 11 testes
- [x] Simulador de sensor — 4 testes (atualizado para cobrir os 4 campos AI4I novos)
- [x] Endpoints do FastAPI (`/health`, `/predict`) — 5 testes pytest
- [x] **[NOVO]** Faixas de risco configuráveis (`risk-threshold.schema`) — 4 testes
- [x] **[NOVO]** Schema de usuários (create/update/reset de senha/troca de senha) — 10 testes
- [x] **[NOVO]** Linha de CSV de leituras (trata célula vazia como ausente, não como zero) — 4 testes
- [x] **[NOVO]** `computeNextExecution` do scheduler, todas as `FrequencyType` — 8 testes
- [ ] Testes de integração dos **services que usam Prisma diretamente** (`work-order.service.ts`, `alert.service.ts`, `maintenance-plan.service.ts`, `prediction.service.ts`, `failure-event.service.ts`) — precisam de um banco de teste (ex: Neon branch de teste, ou Postgres local via Docker)
- [ ] Testes de integração do fluxo completo `SensorReading → Prediction → Alert → WorkOrder`
- [ ] Testes E2E (Playwright/Cypress) do fluxo de login → criar equipamento → criar OS → mudar status — **nenhum suite automatizado existe no repositório**. Foram feitos testes manuais extensivos com Playwright durante o desenvolvimento (login, filtros, dark mode, modais, transições de status), mas como scripts avulsos fora do repo, não como testes versionados/repetíveis. Um desses testes manuais, aliás, foi o que **encontrou dois bugs reais de submissão no formulário de transição de status de OS** (um pré-existente, um introduzido numa rodada anterior) — reforça a prioridade deste item: sem E2E versionado, esse tipo de bug só aparece quando um humano clica manualmente

## 🟡 Segurança — pontos a revisar

- [ ] Rate limiting no endpoint `POST /api/v1/predict` do FastAPI (hoje sem limite de requisições)
- [ ] Rate limiting no login (`Credentials` provider) para mitigar força bruta
- [ ] Validar tamanho máximo de payload em todos os endpoints (Next.js Server Actions e FastAPI)
- [ ] `AuditLog` cobre mais operações do que antes, mas ainda não é universal — hoje escreve em: criação/edição de equipamento, criação/edição/ativação/redefinição de senha de usuário, atualização de faixas de risco. **Ainda falta**: criação de OS e mudanças de status, criação/edição de planos preventivos, ações de alerta (reconhecer/converter em OS), import de CSV de leituras, registro de falha real (`FailureEvent`)
- [ ] Adicionar expiração/refresh de sessão configurável (hoje usa o padrão do NextAuth JWT)
- [x] ~~Sanitizar/validar uploads futuros (quando o CSV de sensores for implementado)~~ — **CSV de sensores já foi implementado** (import por equipamento, validado linha a linha via Zod, linha inválida não derruba o lote). **Ainda falta**: validação de tamanho/tipo de arquivo no servidor (hoje só o atributo `accept=".csv"` do input, que é só uma dica de UI, não uma trava real)
- [ ] **[NOVO]** O usuário "de sistema" (`sistema@pcm.local`, criado pelo seed para o scheduler automático assinar como `createdBy` das OS geradas) precisa de uma trava para nunca ser excluído/reativado por engano pela tela de usuários — hoje nada impede isso

## 🟡 Regras de negócio a refinar

- [ ] **Numeração de OS** (`OS-2026-0001`): hoje calculada por `count()`, o que pode gerar números duplicados sob concorrência alta. Trocar por uma `sequence` do Postgres ou transação com `SELECT ... FOR UPDATE`. **Atenção**: o scheduler automático de OS preventivas (novo) processa planos vencidos sequencialmente (não em paralelo) especificamente por causa dessa limitação — resolver a numeração de forma definitiva permitiria paralelizar a geração
- [ ] **Alertas duplicados**: se o mesmo equipamento gerar várias predições de risco alto seguidas, hoje um novo `Alert` é criado a cada vez — avaliar se deveria reaproveitar/atualizar um alerta `OPEN` já existente para o mesmo equipamento
- [ ] Cópia do checklist do plano para a OS preventiva: revisar comportamento quando o plano não tem nenhum item de checklist (hoje gera OS sem checklist, o que é esperado, mas vale confirmar com o time)
- [ ] Definir regra de negócio para equipamentos **inativos**: hoje nada impede registrar leitura/gerar OS para um equipamento com status `INACTIVE`
- [ ] **[NOVO]** Faixas de risco configuráveis (`RiskThresholdConfig`) valem para o sistema inteiro — não há como ter faixas diferentes por tipo/criticidade de equipamento, caso o time de confiabilidade precise disso no futuro

## 🟢 Performance / arquitetura — otimizações

- [ ] Adicionar cache/revalidação mais granular no Next.js (hoje `revalidatePath` é usado de forma ampla; pode ser otimizado com `revalidateTag`)
- [ ] Avaliar índices adicionais no Postgres para queries do dashboard (ex: `Prediction.createdAt` já tem índice, mas queries agregadas por período podem se beneficiar de índices compostos). `FailureEvent` novo já nasceu com índices em `equipmentId` e `occurredAt`
- [ ] `getRiskEvolution()` no dashboard busca até 200 predições e agrega em memória — trocar por agregação via SQL (`GROUP BY` por dia) quando o volume de dados crescer
- [ ] Configurar connection pooling adequado do Prisma para o Neon (verificar `connection_limit` na `DATABASE_URL` pooled)
- [x] ~~Adicionar `loading.tsx`/`error.tsx` do App Router nas rotas principais para melhor streaming/UX~~ — feito (ver seção UI/UX acima)
- [ ] Avaliar mover gráficos do Recharts para client components mais isolados (hoje toda a página do dashboard é Server Component, o que é bom, mas vale revisar o bundle size do Recharts)
- [x] Build isolado documentado: `NEXT_DIST_DIR=.next-demo-build pnpm build` evita sobrescrever o cache `.next` de um `next dev` usado no ensaio

## 🟢 DevOps / qualidade contínua

- [ ] CI (GitHub Actions ou similar) rodando: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pytest` a cada PR — **bloqueado por não ser um repositório git ainda** (ver bloqueador no topo)
- [ ] Pre-commit hooks (lint-staged/husky) para evitar commits com erro de lint
- [ ] Monitoramento/observabilidade: logs estruturados em produção (hoje só `console`/logging básico do FastAPI)
- [ ] Health check do FastAPI integrado a um serviço de uptime monitoring
- [ ] Backup automático do Neon (verificar plano/configuração no painel do Neon)
- [ ] Documentar processo de rollback de migrations
- [ ] **[NOVO]** Documentar formalmente (num `docs/` ou no README de `apps/web/prisma`) o workaround de `db push` + migration manual + `migrate resolve --applied` usado neste projeto por causa do bug do shadow database do Neon — sem isso, a próxima pessoa vai tropeçar no mesmo erro `P1001` e não vai saber que é uma limitação conhecida do Neon, não um problema de configuração
