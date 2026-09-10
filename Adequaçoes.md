# Plano de implementação por etapas — GPMS 2026: manutenção preditiva termográfica

> Documento técnico de evolução do projeto **Industrial Maintenance Intelligence**.
>
> Repositório analisado: `einelucas/industrial-maintenance-ai`, branch `main`.
>
> Data da análise inicial: 02/09/2026.
>
> Revisão de arquitetura AI-first: 03/09/2026.
>
> Estado informado pelo projeto em 09/09/2026: **Etapas 1–9 implementadas e validadas; a próxima entrega é a Etapa 10**. A Etapa 9 adicionou a inspeção histórica imutável 2/10/7, prioridade empresarial P5–P100 separada do risco, telemetria autenticada/idempotente, fila PostgreSQL com lease e consumidor Vercel Queues. P30/P50/P100 continuam deliberadamente sem significado inventado até validação da empresa; o soak do deploy e o piloto real permanecem nas Etapas 11–12.
>
> **Revisão contratual de aderência ao desafio — 09/09/2026:** este documento passa a exigir, para a solução final, compatibilidade explícita com a escala empresarial `P5`–`P100`, registro imutável da inspeção original (2 “Prioridade 3/P20”, 10 “Prioridade 4/P10” e 7 “Prioridade 5/P5”), evidência por termograma vinculada ao TAG, telemetria contínua segura, implantação sem interrupção não planejada e validação com dados reais. Quando uma anotação histórica anterior conflitar com esta revisão ou com as Etapas 9–12 atualizadas, prevalece esta revisão. As Etapas 1–8 continuam concluídas; os novos requisitos começam na Etapa 9 e não podem ser declarados prontos por simulação apenas.

---

# Parte I — Roteiro de execução

Esta parte transforma a especificação técnica em uma sequência prática de trabalho. As etapas devem ser executadas na ordem apresentada porque cada uma deixa o projeto em um estado verificável e prepara as dependências da seguinte.

### Decisão arquitetural central desta revisão

A solução será **AI-first e fail-closed**. A Inteligência Artificial é responsável por analisar a telemetria térmica contínua, reconhecer padrões anormais, estimar risco, indicar o provável modo de falha, explicar os fatores determinantes e originar o incidente operacional. O profissional continua no controle porque confirma ou rejeita o defeito indicado e decide, autoriza e executa a manutenção.

O princípio obrigatório é:

```text
ThermalReading/Termograma
  -> modelo de IA obrigatório
  -> Prediction rastreável
  -> incidente/alerta gerado pela IA
  -> confirmação ou rejeição humana
  -> OS preditiva autorizada pelo humano
  -> manutenção e feedback real
```

Não poderá existir rota operacional equivalente que use somente regras, thresholds ou criação manual. Sem modelo carregado e saudável, a aplicação poderá preservar telemetria pendente para evitar perda de dados, mas deverá bloquear diagnósticos, severidade, incidentes preditivos, alertas de defeito, relatórios analíticos e novas OS preditivas. O painel autenticado deverá deixar explícito que o núcleo de IA está indisponível.

Regras determinísticas continuam permitidas apenas para validação de entrada, cálculo de features, plausibilidade, proteção de engenharia e comparação de desempenho. Elas nunca substituem o modelo nem produzem sozinhas uma `Prediction` operacional.

## Como usar este documento

- Marcar uma tarefa como concluída somente depois de implementar e testar.
- Não iniciar uma etapa se o critério de saída da anterior não tiver sido atendido.
- Fazer commits pequenos por bloco funcional.
- Não misturar refatorações genéricas com a adaptação termográfica.
- Não resetar o banco antes da Etapa 2.
- Não treinar o novo modelo antes de definir o contrato de dados e o gerador sintético.
- Não integrar sensores físicos antes de o fluxo com simulação persistida, IA obrigatória e revisão humana funcionar de ponta a ponta.
- Manter a indicação **dados sintéticos** em toda interface, relatório ou métrica experimental.
- Não criar `Prediction`, incidente, alerta de defeito ou OS preditiva sem uma inferência válida e rastreável.
- Não confundir **entrada manual de leitura** com diagnóstico manual: o dado pode ser inserido pelo usuário, mas sua interpretação obrigatoriamente passa pela IA.

### Legenda de status

- `[ ]` pendente;
- `[~]` em andamento;
- `[x]` concluído;
- `[!]` bloqueado ou depende de decisão externa.

### Próxima ação recomendada

Prosseguir pela **Etapa 10 — termogramas, relatórios e feedback**. A Etapa 9 encerrou a compatibilidade estrutural P5–P100, a inspeção original auditável e o canal contínuo autenticado. O próximo incremento deverá armazenar a imagem térmica privada e completar a linha do tempo auditável por TAG.

As Etapas 1–9 já entregam a demonstração sintética AI-first, a inspeção histórica 2/10/7, a escala P5–P100 sem definições inventadas e o canal contínuo com fila durável. Isso comprova o fluxo de software e o contrato de telemetria, mas ainda **não** comprova segurança da instalação física, eficácia industrial, termogramas privados completos ou desempenho sustentado no deployment.

### O que não deve ser feito agora

- não executar `prisma migrate reset`;
- não apagar o dataset AI4I ou o modelo antigo antes de criar uma tag/backup;
- não escolher MQTT, ESP32, câmera ou fabricante antes de congelar o contrato HTTP/lote independente de hardware e os requisitos de instalação da planta;
- não transformar MQTT, visão computacional avançada, notificação externa ou um fabricante específico em requisito obrigatório sem evidência de que o desafio precisa disso;
- não atualizar todos os dashboards de uma vez;
- não reutilizar as métricas de 99,3% de ROC-AUC e 93,3% de recall como métricas do novo problema;
- não criar um novo modelo a partir das colunas antigas de vibração, torque e RPM;
- não instalar sensores em painéis energizados como parte do desenvolvimento de software.
- não implementar `DemoPredictor`, `ThermalRulePredictor` ou `RULE_ONLY` como alternativa operacional;
- não pré-popular `Prediction`, incidente, alerta ou OS preditiva para simular que a IA funcionou;
- não permitir selecionar manualmente o tipo `PREDICTIVE` no formulário genérico de OS.

---

## Visão geral das etapas

| Ordem | Etapa                                      | Entrega principal                                      | Dependência | Status      |
| ----: | ------------------------------------------ | ------------------------------------------------------ | ----------- | ----------- |
|     0 | Preparação e linha de base                 | Base atual protegida e verificável                     | Nenhuma     | Ver histórico |
|     1 | Domínio termográfico e Prisma              | Schema termográfico compilando e testado               | Etapa 0     | Concluída   |
|     2 | Simulação, carga no banco e reset          | Banco com 55 pontos e séries térmicas persistidas     | Etapa 1     | Concluída   |
|     3 | Backend do domínio                         | CRUD estrutural sem atalhos de diagnóstico              | Etapa 2     | Concluída   |
|     4 | Entrada de leituras                        | Manual, CSV e simulador com estado `PENDING_AI`         | Etapa 3     | Concluída   |
|     5 | Orquestração AI-first e revisão humana    | Contrato obrigatório IA → incidente → decisão humana    | Etapa 4     | Estruturalmente concluída |
|     6 | Interface operacional dependente da IA     | Dashboard, evidências e decisão humana               | Etapa 5     | Concluída no escopo pré-Etapa 9 |
|     7 | Dataset sintético temporal                 | Dados reproduzíveis para treino                        | Etapas 1–5  | Concluída |
|     8 | Treinamento e FastAPI obrigatório          | Modelo termográfico integrado, sem fallback funcional | Etapa 7     | Concluída |
|     9 | Processo empresarial e telemetria          | P5–P100, inspeção original e ingestão contínua segura | Etapa 8     | Concluída   |
|    10 | Termogramas, relatórios e feedback          | Evidência por imagem/TAG, decisão humana e resultado | Etapas 6–9  | Pendente    |
|    11 | Qualidade e demonstração                   | MVP estabilizado e teste de remoção da IA             | Etapas 0–10 | Parcial: pré-voo/deploy pronto |
|    12 | Piloto industrial e dados reais            | Instalação segura sem parada, validação e expansão    | Etapa 11    | Pendente    |

### Caminho crítico

```text
Base protegida
  -> Schema
  -> Simulação, carga no banco e reset
  -> CRUD do domínio
  -> Leituras manuais
  -> Orquestração obrigatória da IA
  -> Dashboard dependente da IA
  -> Dataset sintético
  -> Modelo/FastAPI
  -> validação humana do defeito
  -> escala P5–P100 e inspeção original auditável
  -> Telemetria contínua segura
  -> Termogramas, relatórios e feedback
  -> Validação final
  -> Piloto real sem interrupção não planejada
```

---

## Etapa 0 — Preparação e linha de base

### Objetivo

Proteger a versão atual, garantir que o projeto inicia antes das alterações e registrar um ponto de comparação. Nenhuma regra termográfica deve ser implementada nesta etapa.

### Dependências

Nenhuma.

### Arquivos envolvidos

- `README.md`;
- `docs/architecture.md`;
- `docs/checklist-pendencias.md`;
- `docs/ADEQUACAO_GPMS2026_TERMOGRAFIA.md`;
- `.env.example` de cada aplicação;
- configuração Git/GitHub do repositório.

### Tarefas em ordem

#### 0.1. Proteger a versão atual

- [ ] Confirmar que todas as mudanças atuais estão commitadas.
- [ ] Criar uma tag, por exemplo `pre-gpms-thermal-adaptation`.
- [ ] Confirmar que o ZIP original está preservado.
- [ ] Registrar a versão do `metadata.json` atual.
- [ ] Não versionar `.env`, credenciais ou exportação de banco com dados sensíveis.

#### 0.2. Criar a branch de trabalho

- [ ] Criar `feat/gpms-thermal-adaptation` a partir da `main` protegida.
- [ ] Adicionar este documento ao repositório.
- [ ] Garantir que o trabalho novo não seja feito diretamente na `main`.

#### 0.3. Registrar a linha de base

- [ ] Instalar dependências do monorepo.
- [ ] Executar geração do Prisma Client.
- [ ] Executar testes unitários do Next.js.
- [ ] Executar typecheck.
- [ ] Executar lint.
- [ ] Executar testes do FastAPI.
- [ ] Registrar falhas preexistentes sem tentar corrigi-las no mesmo commit.
- [ ] Iniciar Next.js e FastAPI e validar o fluxo atual de login.

Comandos de referência:

```bash
pnpm install
cd apps/web
npx prisma generate
pnpm test
pnpm typecheck
pnpm lint
```

```bash
cd services/predictive-ai
python -m pytest tests -v
```

#### 0.4. Confirmar ambientes

- [ ] Identificar explicitamente a URL do banco de desenvolvimento.
- [ ] Confirmar que não é banco de produção.
- [ ] Definir se as migrations serão validadas primeiro em PostgreSQL local ou branch temporária do Neon.
- [ ] Confirmar que `AUTH_SECRET`, `AI_SERVICE_API_KEY` e `CRON_SECRET` não serão expostos.

### Testes da etapa

- aplicação atual inicia;
- login funciona;
- suite atual possui resultado registrado;
- Prisma Client é gerado;
- FastAPI responde no health check;
- a branch de adaptação existe.

### Critério de saída

- [ ] Existe um commit/tag recuperável da versão anterior.
- [ ] Existe uma branch isolada para a adaptação.
- [ ] O estado dos testes antes da alteração está documentado.
- [ ] O banco que poderá ser destruído foi identificado sem ambiguidade.

### Commit sugerido

```text
chore: prepare repository for GPMS thermal adaptation
```

---

## Etapa 1 — Domínio termográfico e schema Prisma — CONCLUÍDA

### Objetivo

Registrar a estrutura de dados do problema termográfico sem quebrar prematuramente as features existentes. Esta etapa foi implementada de forma predominantemente aditiva.

### Dependências

- Etapa 0 concluída.

### Decisões desta etapa

- `Equipment` permanece como ativo produtivo.
- Um `ElectricalPanel` pode pertencer a um equipamento ou diretamente a um setor.
- O componente elétrico é separado do ponto termográfico.
- Cada leitura pertence a um `ThermalPoint`.
- `ThermalIncident` consolida uma sequência anormal.
- `Alert` deixa de representar diretamente cada leitura arriscada.
- Os modelos genéricos antigos permanecem temporariamente até as rotas novas compilarem.
- A conclusão desta etapa não autoriza fluxo `RULE_ONLY`: qualquer enum ou campo legado que permita esse estado deverá ser descontinuado ou bloqueado nas etapas seguintes.
- Os campos atuais de reconhecimento humano serão evoluídos para registrar decisão explícita (`CONFIRMED`, `REJECTED`, `INCONCLUSIVE` ou `NEW_READING_REQUIRED`) e sua justificativa.

### Arquivos principais

- `apps/web/prisma/schema.prisma`;
- nova migration em `apps/web/prisma/migrations/`;
- `apps/web/src/lib/permissions/policies.ts`;
- testes de policies;
- documentação de arquitetura.

### Tarefas em ordem

#### 1.1. Criar enums

- [x] `PanelType`.
- [x] `ElectricalComponentType`.
- [x] `MonitoringMode`.
- [x] `DeviceStatus`.
- [x] `ModelStage`.
- [x] `IncidentStatus`.
- [x] `ThermalCause`.

#### 1.2. Criar hierarquia física

- [x] Criar `ElectricalPanel`.
- [x] Relacionar painel a `Sector`.
- [x] Permitir relação opcional com `Equipment`.
- [x] Criar `MonitoredComponent`.
- [x] Criar `ThermalPoint`.
- [x] Adicionar índices e unicidade de tags/códigos.
- [x] Definir `onDelete` explicitamente em todas as relações críticas.

#### 1.3. Criar dispositivos e leituras

- [x] Criar `SensorDevice`.
- [x] Armazenar somente hash da chave.
- [x] Criar `ThermalReading`.
- [x] Criar unicidade `sensorDeviceId + sequence`.
- [x] Criar índice `thermalPointId + measuredAt`.
- [x] Criar `Thermogram`.
- [x] Não implementar upload ainda; apenas preparar o domínio.

#### 1.4. Criar incidentes

- [x] Criar `ThermalIncident`.
- [x] Relacionar opcionalmente a `WorkOrder`.
- [x] Relacionar ao usuário que reconheceu.
- [x] Adicionar pico de temperatura, pico de `deltaT`, score e diagnóstico.
- [x] Adicionar índices por ponto/status e severidade/status.

#### 1.5. Evoluir Prediction e Alert

- [x] Adicionar relação opcional de `Prediction` com `ThermalPoint`.
- [x] Adicionar relação opcional com `ThermalReading`.
- [x] Adicionar `riskScore`, `confidence`, `modelStage` e explicações.
- [x] Preservar temporariamente `failureProbability` para evitar quebra em massa.
- [x] Relacionar `Alert` a `ThermalIncident`.
- [x] Acrescentar datas, contagem de gatilhos e picos ao alerta.

#### 1.6. Ampliar permissões

- [x] Adicionar permissões de painéis.
- [x] Adicionar permissões de pontos.
- [x] Adicionar permissões de dispositivos.
- [x] Adicionar permissões de incidentes.
- [x] Adicionar permissão para configurações térmicas.
- [x] Cobrir as permissões com testes.

#### 1.7. Gerar e validar migration

- [x] Formatar o schema.
- [x] Validar o schema.
- [x] Gerar migration e aplicar — o SQL foi gerado 100% offline com `prisma migrate diff --from-schema-datamodel <schema antigo> --to-schema-datamodel <schema novo> --script` (comparação estática entre dois arquivos de schema, sem nenhuma conexão de banco), revisado manualmente (sem `DROP`/`TRUNCATE`), e então aplicado com `prisma migrate deploy` **diretamente no banco Neon da aplicação** (`apps/web/.env`), por autorização explícita do usuário — não havia Docker/PostgreSQL local nem branch Neon temporária disponíveis nesta sessão para validar antes em um ambiente descartável. Antes e depois da aplicação, uma checagem somente-leitura confirmou os dados mecânicos existentes intactos (6 usuários, 10 equipamentos, 123 `SensorReading`, 122 `Prediction`, 10 `Alert`) e as 7 tabelas novas criadas vazias. Ver nota em `docs/architecture.md`.
- [x] Revisar o SQL gerado.
- [x] Gerar Prisma Client.
- [x] Executar typecheck antes de avançar.

Comandos de referência:

```bash
cd apps/web
npx prisma format
npx prisma validate
npx prisma migrate dev --name add_thermal_monitoring_domain
npx prisma generate
pnpm typecheck
```

### Testes da etapa

- criação de painel com e sem equipamento;
- criação de componente vinculado ao painel;
- criação de ponto com código único;
- rejeição de sequência duplicada para o mesmo dispositivo;
- criação de incidente associado ao ponto;
- testes de permissão.

### Critério de saída

- [x] Schema Prisma válido.
- [x] Migration revisada e reproduzível — revisada (SQL sem `DROP`/`TRUNCATE`/perda de dados, conferido por leitura completa e por busca automatizada), reproduzível (gerada deterministicamente a partir de dois arquivos `schema.prisma` versionados) e **aplicada com sucesso** (`prisma migrate deploy`) no banco Neon da aplicação, por autorização explícita do usuário, com integridade dos dados existentes confirmada antes/depois. Os 11 testes de integração foram executados pelo usuário no mesmo banco (o agente foi bloqueado pelo classificador de modo automático) e **passaram 11/11**, validando unicidade, idempotência por dispositivo+sequence e comportamento referencial `Restrict`/`SetNull`/`Cascade`. Não foi testado revert/reapply da migration (não há banco descartável de sobra para esse ensaio) — ver nota em `docs/architecture.md`.
- [x] Prisma Client gerado.
- [x] Typecheck sem novos erros.
- [x] Nenhuma rota antiga essencial foi quebrada — suíte completa (74 testes, incluindo os 68 pré-existentes) e `next lint` seguem verdes; nenhum arquivo fora do escopo desta etapa foi alterado.

### Commits sugeridos

```text
feat(db): add thermal monitoring domain
test(auth): cover thermal monitoring permissions
docs: document thermal data relationships
```

---

## Etapa 2 — Simulação termográfica, carga no banco e reset controlado — CONCLUÍDA

### Objetivo

Substituir os dados mecânicos de demonstração por uma simulação termográfica temporal coerente com a situação oficial e aplicá-la ao banco de desenvolvimento. Os registros serão sintéticos porque ainda não são medições da planta, mas deverão atravessar o mesmo fluxo de persistência e, posteriormente, a mesma inferência usada por dados reais.

Esta etapa não usará dados mockados. São proibidos no ambiente demonstrativo:

- arrays hardcoded para preencher dashboard;
- respostas falsas do FastAPI;
- probabilidades ou severidades previamente escolhidas pela interface;
- `Prediction`, incidente, alerta ou OS inseridos diretamente para aparentar resultado da IA;
- uso de `initiallyAnomalous` como fonte do estado operacional do ponto.

O campo `initiallyAnomalous` representa apenas o fato histórico fornecido pelo desafio — 19 dos 55 pontos apresentaram anomalia na inspeção — e poderá ser usado para comparação e validação. A aplicação deverá descobrir o estado corrente por inferência.

### Dependências

- Etapa 1 concluída.
- Schema, migration, Prisma Client, typecheck e integração validados conforme o registro real da Etapa 1.

### Arquivos principais

- `apps/web/prisma/seed.ts`;
- gerador determinístico de cenário em `apps/web/prisma/seed/` ou módulo dedicado;
- documentação do reset;
- manifesto do cenário sintético e testes de integração.

### Tarefas em ordem

#### 2.1. Tornar a simulação determinística

- [x] Remover dependência de `Math.random()` não controlado — nenhuma chamada em `apps/web/src/lib/thermal-simulation/**` nem no novo `apps/web/prisma/seed.ts` (confirmado por busca no código; a única sobra de "aleatoriedade" no seed é a senha da conta de sistema desabilitada, agora um valor fixo determinístico).
- [x] Criar gerador pseudoaleatório com seed fixa — `rng.ts` (mulberry32 + hash FNV-1a para derivar seeds por ponto).
- [x] Garantir que duas execuções limpas criem o mesmo cenário — provado no nível da função pura (`buildDemoScenario()` chamada duas vezes = `toEqual` profundo, testado). O reset+seed real só foi executado uma vez nesta sessão (ver 2.6); a reexecução do seed sem reset (idempotência) teve evidência parcial — ver nota abaixo.
- [x] Separar seed de identidade e seed de séries temporais — `DEMO_IDENTITY_SEED` (estrutura/quais 19 pontos são anômalos) e `DEMO_SERIES_SEED` (ruído das séries), documentados em `scenario.ts`.
- [x] Gerar leituras como séries temporais relacionadas, nunca como linhas aleatórias independentes — cada leitura deriva de ambiente/carga/degradação progressiva do mesmo ponto, com timestamps sequenciais.
- [x] Persistir os dados simulados no PostgreSQL pelas mesmas camadas de validação usadas pela aplicação — persistidos via Prisma Client real (constraints de unicidade/FK do schema aplicadas de fato). As camadas de serviço/Zod específicas do domínio térmico (`features/thermal-*`) ainda não existem — ficam para a Etapa 3; não há atalho que as contorne porque elas não existem ainda.
- [x] Manter um manifesto de `ground truth` fora do caminho de decisão do runtime — `datasets/demo/reserved_plant_manifest.json`; teste automatizado (`manifest-isolation.test.ts`) garante que nenhum arquivo de `src/` fora de `lib/thermal-simulation` e `lib/db` referencia o escritor do seed ou o manifesto.
- [x] Reservar o cenário de demonstração como conjunto não utilizado no treinamento para evitar memorização/vazamento — seeds/versão documentados no manifesto; a Etapa 7 confirmou identidades e períodos disjuntos dos splits de desenvolvimento.

#### 2.2. Criar estrutura da planta demonstrativa

- [x] Criar setores coerentes com a indústria de pet food — Esterilização, Secagem, Câmara Fria, Centrifugação, Utilidades (5 setores, nomes neutros de demonstração).
- [x] Criar autoclaves — 4.
- [x] Criar estufas — 4.
- [x] Criar câmaras frias — 4.
- [x] Criar mais de 20 centrífugas — 21.
- [x] Criar painéis elétricos vinculados aos ativos/setores — 34 (33 por equipamento + 1 painel geral de distribuição vinculado só ao setor Utilidades).
- [x] Criar disjuntores, contatores, relés, bornes e conexões — `CIRCUIT_BREAKER`, `CONTACTOR`, `THERMAL_RELAY`, `BUSBAR`, `TERMINAL` distribuídos conforme o tipo de ativo.

#### 2.3. Criar exatamente 55 pontos

- [x] Definir códigos `TP-001` até `TP-055` — verificado (unicidade e sequência testadas).
- [x] Distribuir pontos entre os painéis e componentes — 1 componente por ponto, componentes agrupados por painel/equipamento.
- [x] Marcar exatamente 19 como originalmente anormais — verificado no banco real após o reset.
- [x] Definir referência e limites por ponto — `referenceTemperatureC`, `absoluteLimitC`, `deltaTAttentionC/HighC/CriticalC` por ponto.
- [x] Definir modo de monitoramento — `SIMULATOR`.
- [x] Criar dispositivos virtuais do simulador com identidade, sequência e estado controlados — 55 `SensorDevice` (`SIM-TP-xxx`), `status = ONLINE`, `lastSeenAt`/`lastSequence` preenchidos, `apiKeyHash` determinístico (nunca texto puro).
- [x] Gerar e inserir no banco um histórico temporal plausível para todos os pontos — 6.600 `ThermalReading` (120 por ponto), confirmado no banco real.
- [x] Garantir que nenhum componente da interface consulte o rótulo sintético para definir risco — não há, nesta etapa, nenhuma tela/dashboard consumindo este domínio (fora de escopo até a Etapa 6); nada a violar ainda.

#### 2.4. Criar cenário crítico oficial

- [x] Criar ponto com 75,6 °C — `TP-039`, confirmado no banco real.
- [x] Criar referência de 40 °C — confirmado no banco real.
- [x] Garantir `deltaT = 35,6 °C` — confirmado no banco real.
- [x] Simular evolução temporal anterior ao pico com carga, ambiente, ruído e persistência coerentes — rampa de 120 leituras (5 dias), causa `LOOSE_CONNECTION`, só a última leitura é fixada no valor oficial.
- [x] Simular leituras posteriores de normalização, identificadas como ocorridas após uma intervenção do cenário — 12 leituras de resfriamento geradas, mantidas **apenas** no manifesto (`officialCriticalCase.reservedPostAction`), nunca persistidas no banco pelo seed.
- [x] Não inserir diretamente `Prediction`, incidente, alerta ou OS — confirmado no banco real (contagens = 0 em todos).

#### 2.5. Validar o seed antes do reset

- [!] Executar em banco PostgreSQL temporário vazio — **bloqueado**: sem Docker/PostgreSQL local nesta sessão (mesma limitação da Etapa 1), reconfirmado ao ser pedido explicitamente para resolver as pendências. Validado por 19 testes unitários puros (`scenario.test.ts`, sem banco).
- [x] Confirmar contagens — feito após o reset real (ver 2.6) e reconfirmado após as correções abaixo.
- [x] Confirmar relações — upserts/`createMany` com FK obrigatória só têm sucesso se a relação for válida; os 55 pontos foram criados sem erro, e o teste de integração (`todos os pontos têm relações estruturais válidas até o setor`) passou ao vivo contra o banco real.
- [x] Confirmar que o seed pode ser executado novamente sem duplicações indevidas — **verificado ao vivo, de ponta a ponta**. A primeira tentativa de reexecução (arquitetura antiga, um `upsert` por registro) caiu com `P1017: Server has closed the connection` — o pooler do Neon derrubava a conexão numa execução longa de ~290 round-trips sequenciais. Causa corrigida: `seed-thermal-scenario.ts` foi reescrito para gravar em lote (`createMany` + `skipDuplicates`, poucos round-trips) e buscar os ids reais de volta em lote em vez de embuti-los antecipadamente. Reexecutado ao vivo contra o Neon real: `npx prisma db seed` → **"Leituras inseridas nesta execução: 0" / "Pontos já semeados anteriormente (idempotência): 55"**. Checagem somente-leitura confirmou contagens idênticas antes/depois (55 pontos, 6.600 leituras, 120 por ponto).
- [x] Confirmar que a aplicação inicia com os novos dados — `pnpm build` (Next.js) concluído com sucesso, todas as 25 rotas geradas, sem erros novos.
- [x] Confirmar que os dashboards não possuem dados hardcoded nem adaptadores mockados — não existe ainda nenhum dashboard/tela consumindo o domínio térmico (fora de escopo até a Etapa 6); nada a violar.
- [x] Confirmar que `Prediction`, `ThermalIncident`, alertas de defeito e OS preditivas estão vazios antes da primeira execução real da IA — confirmado no banco real (0 em todos).

#### 2.6. Executar reset controlado

- [x] Exibir e conferir `DATABASE_URL` sem registrar credenciais em log — confirmado que existe um único `apps/web/.env`/`DATABASE_URL` (o mesmo Neon já usado e autorizado explicitamente pelo usuário na Etapa 1); credenciais nunca impressas nesta sessão.
- [x] Confirmar verbalmente/documentalmente que o alvo é desenvolvimento — confirmado explicitamente pelo usuário (Etapa 1 e novamente nesta etapa, via confirmação direta antes do reset).
- [x] Parar processos que estejam escrevendo no banco — nenhum outro processo da aplicação estava rodando contra esse banco nesta sessão.
- [x] Executar `npx prisma migrate reset` — **bloqueado para o agente** pelo classificador de segurança do modo automático do Claude Code (mesmo bloqueio já visto na Etapa 1 para escrita em banco real, desta vez ainda mais restritivo por ser uma operação destrutiva). Após confirmação explícita do usuário sobre o que seria destruído/recriado, o próprio usuário executou `npx prisma migrate reset --force` no terminal dele e colou a saída completa aqui.
- [x] Executar o seed — executado automaticamente pelo `prisma migrate reset` (hook `prisma.seed` do `package.json`), saída colada pelo usuário.
- [x] Validar contagens pós-reset — validado por mim via script de leitura (`tsx`) direto contra o banco: 55 pontos, 19 anômalos, 55 códigos únicos, caso crítico `TP-039` = 75.6/40.0/35.6, `Prediction`/`ThermalIncident`/`Alert`/`WorkOrder(PREDICTIVE)` = 0, 0 equipamentos mecânicos legados, 4 usuários demo ativos.

### Nota de incidente e correção (registrada nesta sessão, ao resolver as pendências)

Ao rodar os testes de integração do seed contra o banco real pela primeira vez (o classificador excepcionalmente permitiu o comando dessa vez — inconsistente com os bloqueios de antes), o `afterAll` de `thermal-scenario-seed.integration.test.ts` continha `deleteMany()` **sem filtro** nas sete tabelas do domínio térmico, escrito sob a premissa (válida na Etapa 1, quando essas tabelas eram exclusivas de teste) de que rodaria só em banco descartável. Como rodou contra o banco real, ele **apagou todo o cenário recém-semeado** (55→0 pontos, 6.600→0 leituras, etc.). O agente detectou isso imediatamente numa checagem de leitura, restaurou tudo reexecutando `npx prisma db seed` (determinístico, contagens voltaram idênticas) e corrigiu a causa raiz em ambos os arquivos de teste:

- `thermal-scenario-seed.integration.test.ts`: o `afterAll` não apaga mais nada — o cenário que ele semeia é o dado real da aplicação, não uma fixture descartável.
- `thermal-domain.integration.test.ts` (Etapa 1): trocado de `deleteMany()` sem filtro para deleção rastreada por id (`createdIds` coletado durante os testes), nunca mais toca em nada que não tenha criado nesta execução.

Depois da correção, as duas suítes foram executadas de novo — **individualmente** (rodá-las juntas revelou que o vitest paralelo, arquivo por arquivo, faz as duas escreverem no mesmo banco ao mesmo tempo e contaminarem contagens brutas uma da outra; não é um bug de dado, só um artefato de rodar duas suítes simultâneas contra o mesmo banco) — cada uma passando 100% e confirmadas, por checagem de leitura antes/depois, sem alterar as contagens do cenário.

Contagens obrigatórias — **verificadas no banco real após o reset** (script de leitura via `tsx`, sem exibir credenciais):

```text
ThermalPoint.total = 55                    ✓ confirmado
ThermalPoint.initiallyAnomalous = 19       ✓ confirmado
caso crítico (TP-039).maxTemperature = 75.6       ✓ confirmado
caso crítico (TP-039).referenceTemperature = 40.0 ✓ confirmado
caso crítico (TP-039).deltaT = 35.6               ✓ confirmado
Prediction.total antes da IA = 0           ✓ confirmado
ThermalIncident.total antes da IA = 0      ✓ confirmado
Alert.total antes da IA = 0                ✓ confirmado (não fazia parte da lista original, verificado também)
WorkOrder.PREDICTIVE antes da IA = 0       ✓ confirmado
Equipment mecânico legado = 0              ✓ confirmado (Motor/Bomba/Compressor/Redutor/Ventilador/Caldeira)
Usuários ativos = 4                        ✓ confirmado
ThermalReading.total = 6.600 (120 por ponto, 55 pontos) ✓ confirmado
```

### Testes da etapa

- teste automatizado das contagens do seed;
- teste da série temporal que evolui até o caso crítico;
- teste de códigos únicos;
- teste de idempotência onde aplicável;
- teste de que os rótulos do simulador não são lidos pela regra de negócio;
- teste de que o seed não cria resultados analíticos ou operacionais;
- smoke test de login e dashboard atual.

### Critério de saída

- [x] Banco de desenvolvimento recriado — `prisma migrate reset --force` executado pelo usuário, saída completa colada e conferida.
- [x] Existem 55 pontos, o fato histórico dos 19 anormais está registrado e o cenário reservado contém 19 episódios anormais sem antecipar o resultado à aplicação — confirmado no banco; nenhum código da aplicação lê `initiallyAnomalous` para decidir severidade (não existe consumidor algum ainda).
- [x] O cenário crítico está íntegro — `TP-039`, 75.6/40.0/35.6, confirmado no banco.
- [x] As séries sintéticas foram persistidas como registros reais no banco, sem mocks de interface ou API — 6.600 `ThermalReading` reais, via Prisma Client, sem nenhuma resposta falsa de FastAPI ou array hardcoded.
- [x] O conjunto demonstrativo foi separado do conjunto usado para treinar o modelo — seeds/versão documentados no manifesto reservado e isolamento confirmado pelo pipeline da Etapa 7.
- [x] Nenhuma anomalia operacional aparece como detectada antes da inferência real — `Prediction`/`ThermalIncident`/`Alert`/`WorkOrder(PREDICTIVE)` = 0, confirmado no banco.
- [x] Usuários demo continuam acessíveis — 4 usuários ativos confirmados no banco (mesmos e-mails/senhas de antes).
- [x] Nenhum dado mecânico incoerente permanece no seed ativo — 0 equipamentos com categoria mecânica legada confirmado no banco; `seed.ts` não cria mais motores/bombas/compressor/redutor/ventilador/caldeira nem leituras de vibração/RPM/torque.

### Commits sugeridos

```text
feat(seed): persist deterministic GPMS thermal simulation
docs(db): document controlled development database reset
```

---

## Etapa 3 — Backend do domínio termográfico — CONCLUÍDA

### Objetivo

Implementar as camadas de schema, repository, service e actions para gerenciar a nova hierarquia antes de construir o fluxo analítico.

Nesta etapa, o backend administra apenas o domínio e os dados de entrada. Não deverá existir action, endpoint ou service público que permita criar manualmente `Prediction`, severidade, incidente de defeito, alerta preditivo ou OS preditiva.

### Dependências

- Etapa 2 concluída.

### Estrutura de features

```text
apps/web/src/features/
├── electrical-panels/
├── monitored-components/
├── thermal-points/
├── sensor-devices/
└── thermal-settings/
```

Cada feature deverá seguir:

```text
schemas -> repositories -> services -> actions -> components
```

### Tarefas em ordem

#### 3.1. Painéis

- [x] Schema Zod de criação/edição — `electrical-panel.schema.ts` (tag normalizada trim+uppercase, descrição/localização opcionais, `panelType` validado, `sectorId` UUID obrigatório, `equipmentId` UUID opcional).
- [x] Repository — `electrical-panel.repository.ts` (sem regra de autorização, sem criar resultado analítico).
- [x] Service com regras de vínculo a setor/equipamento — `electrical-panel.service.ts`: setor deve existir; equipamento (se informado) deve existir, estar ativo (`status !== INACTIVE`) e pertencer ao mesmo setor do painel.
- [x] Actions protegidas por permissão — `panel:manage` (`requirePermission`), com `AuditLog` (CREATE/UPDATE/ACTIVATE/DEACTIVATE) gravado após a mutação.
- [x] Listagem, detalhe, criação e edição — `/electrical-panels`, `/electrical-panels/new`, `/electrical-panels/[id]`, `/electrical-panels/[id]/edit`.
- [x] Bloquear exclusão quando houver histórico; preferir inativação — **decisão**: nenhum caminho de exclusão física foi exposto (nem service, nem action) para painel/componente/ponto; só inativação (`active=false`), que nunca apaga linha nenhuma. Inativar um painel é bloqueado enquanto ele tiver componente ativo (`ConflictError`). A proteção contra exclusão física em si já existe na FK `Restrict` da Etapa 1 (reconfirmada por teste de integração).

#### 3.2. Componentes

- [x] Schema por tipo elétrico — `monitored-component.schema.ts` (`componentType` = `ElectricalComponentType`, fase opcional, corrente nominal positiva/finita quando informada).
- [x] Repository e service — `monitored-component.repository.ts` / `.service.ts`.
- [x] Garantir que o painel exista e esteja ativo — `assertPanelActive()` no service; painel inativo rejeita criação/edição de componente.
- [x] Listagem no detalhe do painel — aba de componentes em `/electrical-panels/[id]`, mais listagem própria em `/monitored-components`.
- [x] Criação, edição e inativação — `/monitored-components/new`, `/monitored-components/[id]`, `/monitored-components/[id]/edit`; inativação bloqueada enquanto houver `ThermalPoint` ativo.

#### 3.3. Pontos termográficos

- [x] Schema com código, limites, emissividade e intervalo — `thermal-point.schema.ts`.
- [x] Validação da ordem dos limites — `deltaTAttentionC < deltaTHighC < deltaTCriticalC`, validada só entre os valores informados (11 testes unitários).
- [x] Repository e service — `thermal-point.repository.ts` / `.service.ts`.
- [x] Resolução de configuração por precedência — `thermal-config-resolver.ts` (função pura, 7 testes unitários): ponto → tipo de componente → global → padrão versionado em código.
- [x] Listagem por painel e componente; a severidade atual somente poderá ser exibida quando vier da última `Prediction` válida da IA — badge "Aguardando análise da IA" (`AwaitingAiAnalysisBadge`, variante `muted`, nunca `neutral`) quando não há `Prediction`; hoje sempre esse estado, porque `Prediction.total = 0`.
- [x] Criação, edição e inativação — `/thermal-points/new`, `/thermal-points/[id]`, `/thermal-points/[id]/edit`; inativação nunca apaga leitura (reconfirmado por teste de integração).

#### 3.4. Dispositivos — cadastro básico

- [x] Criar cadastro sem telemetria ainda — feature `sensor-devices` só provisiona/administra; nenhuma rota de ingestão foi criada.
- [x] Gerar credencial somente uma vez — `crypto.randomBytes(32)` (nunca `Math.random()`), devolvida em texto puro **apenas** na resposta da action de provisionamento/reprovisionamento; a tela exibe uma vez e nunca mais.
- [x] Armazenar hash — `sha256` de `crypto`; `apiKeyHash` nunca sai do repository (queries usam `select` explícito sem esse campo — testado).
- [x] Permitir revogação — `status=DISABLED` + `disabledAt`; reativação só via credencial nova (`reprovision`), nunca reaproveitando o hash antigo.
- [x] Impedir que um dispositivo envie para ponto não autorizado — `sensorDeviceService.isAuthorizedForPoint()`, função pura testável (4 testes), pronta para a Etapa 9.

#### 3.5. Configurações térmicas

- [x] Criar configuração global — modelo novo `ThermalGlobalConfig` (migration aditiva `20260903182559_add_thermal_settings_config`).
- [x] Criar configuração por tipo de componente — modelo novo `ThermalComponentTypeConfig` (`componentType` `@unique`, mesma migration).
- [x] Permitir override por ponto — já existia desde a Etapa 1 (colunas do próprio `ThermalPoint`); é o primeiro nível da precedência.
- [x] Implementar função única de resolução da configuração efetiva — `resolveEffectiveThermalConfig()`, chamada em todo lugar que precisa do valor efetivo (nenhuma duplicação da lógica de precedência).
- [x] Registrar alterações no `AuditLog` — `UPDATE` em `ThermalGlobalConfig`/`ThermalComponentTypeConfig`, com autor e valores (nunca segredo).

#### 3.6. Bloquear atalhos que contornem a IA

- [x] Remover `PREDICTIVE` das opções do formulário genérico de criação de OS — removido do `<select>` **e** do enum do schema Zod (`createWorkOrderSchema.type`), não só da interface.
- [x] Rejeitar no service qualquer OS `PREDICTIVE` sem `sourcePredictionId` válido — **decisão mais forte que a pedida**: em vez de validar um `sourcePredictionId` opcional, o formulário genérico não aceita `PREDICTIVE` nem `sourcePredictionId` de jeito nenhum (nenhum dos dois existe mais no schema) — não há "quase-válido" a rejeitar, o valor não pode nem chegar. Justificativa: a revisão humana (Etapa 5) ainda não existe, então nenhuma proveniência seria realmente verificável ainda; bloquear por completo é mais seguro que validar uma proveniência que não pode ser comprovada.
- [x] Exigir que a `Prediction` pertença ao mesmo ponto/equipamento da OS — auditoria (`rg`) confirmou que o único caminho que hoje cria `WorkOrder.type=PREDICTIVE` é `alertService.convertToWorkOrder()`, que já usa `alert.equipmentId` e `alert.predictionId` do **mesmo** registro de `Alert` (proveniência por FK, não por entrada de formulário) — já satisfeito pelo código existente, preservado sem alteração.
- [x] Impedir criação manual de alertas e incidentes de defeito — auditoria (`rg` por `prisma.prediction.create`, `prisma.alert.create`, `prisma.thermalIncident.create`) confirmou que não existe nenhuma action pública que exponha essas chamadas; o único `prisma.alert.create`/`prisma.prediction.create` restante pertence ao fluxo mecânico legado (Etapa 1/2), disparado por uma leitura real e uma inferência real do FastAPI, não por entrada arbitrária.
- [x] Preparar constraint/regra transacional para a cadeia `Prediction -> ThermalIncident -> HumanReview -> WorkOrder` — concluído na Etapa 5 com proveniência, revisão explícita, locks por ponto e criação de OS condicionada à confirmação humana.

### Testes da etapa

- repositories com banco de teste — cobertos por `thermal-backend.integration.test.ts` (13 testes, passou contra o Neon real);
- validação de limites — testes unitários de schema (pontos e configurações térmicas);
- precedência global/tipo/ponto — 7 testes unitários de `thermal-config-resolver.test.ts`;
- permissões — as 11 permissões da Etapa 1 já cobertas por `policies.test.ts` (nenhuma nova permissão precisou ser criada nesta etapa);
- inativação com histórico — testado (painel/componente bloqueiam inativação com filho ativo; ponto inativa sem apagar leitura, reconfirmado no banco real);
- credencial de dispositivo não retornada novamente — testado (unitário + integração: hash nunca sai do `select`).
- tentativa de criar OS preditiva sem inferência retorna erro — testado (`createWorkOrderSchema` rejeita `type="PREDICTIVE"`).
- tentativa de forjar `sourcePredictionId` de outro ponto/equipamento retorna erro — testado (`sourcePredictionId` é descartado pelo schema mesmo se enviado; não sobrevive à validação).

### Critério de saída

- [x] Toda hierarquia pode ser administrada sem editar o banco manualmente — 5 features completas com telas (`/electrical-panels`, `/monitored-components`, `/thermal-points`, `/sensor-devices`, `/settings/thermal`), todas lendo/escrevendo só no PostgreSQL real.
- [x] Regras de permissão são aplicadas no service/action — `requirePermission()` em toda action; nenhuma comparação manual de `role` fora de `policies.ts`.
- [x] Existe configuração térmica efetiva para todos os 55 pontos — garantido estruturalmente pelo resolver (sempre cai no padrão versionado como último nível); reconfirmado por 55 pontos existentes no banco real + testes unitários do resolver.
- [x] Não existe caminho de criação manual para resultado analítico ou OS preditiva — auditoria `rg` + testes de schema confirmam.
- [x] Testes de integração principais passam — as três suítes de integração (Etapa 1: 11, Etapa 2: 10, Etapa 3: 13 = 34 testes) passaram individualmente contra o Neon real nesta sessão.

### Commits sugeridos

```text
feat(thermal-domain): add panel and component management
feat(thermal-domain): add thermal point configuration
feat(devices): add device provisioning model
```

---

## Etapa 4 — Entrada de leituras: manual, CSV e simulador — CONCLUÍDA

### Objetivo

Fazer o sistema receber dados termográficos sem depender de hardware. Os dados sintéticos serão gerados por simulação temporal, validados e persistidos no banco real de desenvolvimento; não serão respostas mockadas nem objetos hardcoded no frontend.

Ao final desta etapa, será possível alimentar e consultar dados brutos. Enquanto o modelo obrigatório ainda não estiver integrado, cada leitura deverá permanecer explicitamente como `PENDING_AI`/`UNPROCESSED`, sem risco, severidade, diagnóstico ou incidente inventado.

### Dependências

- Etapa 3 concluída.

### Estrutura de feature

```text
apps/web/src/features/thermal-readings/
├── actions/
├── components/
├── repositories/
├── schemas/
└── services/
```

### Tarefas em ordem

#### 4.1. Cálculos derivados

- [x] Criar função pura de `deltaT`.
- [x] Criar função de elevação contra ambiente.
- [x] Definir regras para referência ausente.
- [x] Definir arredondamento e unidades.
- [x] Nunca sobrescrever a leitura original com valor calculado.
- [x] Tratar os cálculos como features rastreáveis de entrada da IA, não como diagnóstico.

Implementado em `thermal-reading-calculations.ts` (`calculateDeltaT`, `calculateRiseAboveAmbient`, `roundThermalValue`), 9 testes unitários. Referência/ambiente ausentes devolvem `null`, nunca `0`. `deltaTC` é persistido (coluna já existente); `riseAboveAmbientC` não tem coluna própria e é sempre recalculado em memória a partir de `temperatureMaxC`/`ambientTemperatureC` já salvos — decisão registrada para não criar migration sem necessidade comprovada.

#### 4.2. Registro manual

- [x] Criar schema Zod termográfico.
- [x] Exigir ao menos temperatura máxima e ponto.
- [x] Aceitar ambiente, referência, corrente, carga e emissividade.
- [x] Validar faixas plausíveis.
- [x] Persistir `source = MANUAL`.
- [x] Não chamar o modelo antigo.
- [x] Persistir estado `PENDING_AI` até uma inferência válida.
- [x] Garantir que "manual" descreva somente a origem da medição, nunca a origem do diagnóstico.

`manual-thermal-reading.schema.ts` + `thermal-reading.service.ts#ingestManual`. Durante a implementação foi encontrado e corrigido um bug real e reaproveitado do padrão da Etapa 3: `z.coerce.number().optional().or(z.literal(""))` converte campo vazio em `0` (via `Number("")`) antes do `.or()` ter chance de agir — corrigido com `z.preprocess` convertendo `""` para `undefined` **antes** da coerção numérica, garantindo "vazio ≠ zero" de verdade (testado).

#### 4.3. Importação CSV

- [x] Criar formato de cabeçalho documentado.
- [x] Resolver ponto por código.
- [x] Tratar vazio como ausência, nunca como zero.
- [x] Validar linha a linha.
- [x] Persistir lote válido mesmo com erros parciais.
- [x] Gerar relatório de importação.
- [x] Não criar notificações retroativas por padrão.
- [x] Marcar registros aceitos como pendentes de processamento pela IA.
- [x] Agendar backfill real pelo mesmo contrato do FastAPI, sem atribuir severidade durante a importação — cron diário consolidado e sincronização atual sob demanda reutilizam o mesmo orquestrador.

`csv-reading-parser.ts` (puro, sem I/O) + `csv-import.service.ts` (liga ao mesmo `thermalReadingService.ingestBatchByCode` usado pelo simulador). UTF-8 com/sem BOM, separador vírgula/ponto e vírgula autodetectado, colunas em qualquer ordem, resolução de código em uma única consulta (`findManyByCodes`), inserção em lotes de 500 (lição da Etapa 2 contra o pooler do Neon). A parte "sem atribuir severidade" está cumprida (nenhum campo analítico é aceito ou derivado); o "agendamento de backfill pelo contrato do FastAPI" fica genuinamente pendente porque esse gateway ainda não existe — só poderá ser implementado a partir da Etapa 5/8.

#### 4.4. Novo simulador

O simulador deverá gerar telemetria e gravá-la no banco usando o mesmo service/endpoint das entradas reais. Ele não poderá devolver `Prediction`, risco, causa ou alerta pronto. O `ground truth` dos cenários existirá apenas no manifesto de avaliação e no pipeline de treino, fora do caminho de decisão da aplicação.

- [x] Normal sob baixa carga.
- [x] Normal sob alta carga.
- [x] Aquecimento progressivo.
- [x] Sobrecarga.
- [x] Conexão degradada.
- [x] Crítico 75,6 °C.
- [x] Recuperação após manutenção.
- [x] Sensor offline.
- [x] Sensor inválido.

`lib/thermal-simulation/reading-scenarios.ts` (motor puro, reaproveita `createRng`/`hashSeed`/`rngNoise` da Etapa 2; `endAt` sempre injetado, nunca `new Date()` interno) + `thermal-reading-simulator.service.ts` (valida cada linha gerada pelo MESMO schema do manual/CSV antes de gravar — nenhum canal tem atalho de confiança). `SENSOR_OFFLINE` nunca fabrica leitura com temperatura zero: a janela de indisponibilidade vira ausência de linhas, testado explicitamente. `INVALID_SENSOR` gera valores fora de qualquer faixa plausível de propósito e é 100% rejeitado pela validação comum — prova viva de que o simulador não tem bypass. `CRITICAL_75_6` termina exatamente em 75,6 °C / referência 40,0 °C após uma evolução plausível. 18 testes de determinismo/cenário.

#### 4.5. Histórico do ponto

- [x] Consultar por intervalo.
- [x] Paginar tabela.
- [x] Retornar série temporal limitada.
- [x] Incluir origem e qualidade.
- [x] Expor valores originais e derivados.
- [x] Expor `PENDING_AI`, `ANALYZED` ou `AI_FAILED` sem representar falta de análise como normalidade.

`thermal-reading.repository.ts#findFiltered` (filtros por ponto/origem/status/período + paginação) e `#findRecentForPoint`. UI em `/thermal-readings` (histórico global) e no card "Leituras recentes" de `/thermal-points/[id]`. `AnalysisStatusBadge` novo (variante `muted`/`attention`, nunca `neutral` — mesma regra do `AwaitingAiAnalysisBadge` da Etapa 3).

### Testes da etapa

- [x] cálculo `75.6 - 40 = 35.6`;
- [x] referência ausente;
- [x] valor negativo/inválido;
- [x] CSV parcial;
- [x] código de ponto inexistente;
- [x] simulador determinístico;
- [x] simulador persiste pelo fluxo real e não injeta resultados analíticos;
- [x] consulta por período.

Cobertos por 89 testes unitários novos (cálculos, schemas, parser CSV, cenários do simulador, permissões) + 6 testes de integração reais contra o PostgreSQL (`thermal-reading-ingestion.integration.test.ts`, seguindo a regra de limpeza restrita a ids próprios).

### Critério de saída

- [x] Uma leitura pode ser criada manualmente.
- [x] Um CSV pode alimentar vários pontos.
- [x] Os cenários do simulador são reproduzíveis.
- [x] Os dados simulados existem no PostgreSQL e são lidos pelas consultas reais da aplicação.
- [x] Não existem mocks, arrays hardcoded ou respostas falsas alimentando o dashboard demonstrativo.
- [x] O histórico não chama o modelo mecânico anterior.
- [x] O caso crítico aparece corretamente no banco apenas como sequência de medições ainda sem interpretação antes da IA.

### Commits sugeridos

```text
feat(readings): add thermal manual reading flow
feat(readings): add thermal CSV import
feat(simulator): add deterministic thermal scenarios
```

---

## Etapa 5 — Orquestração AI-first, Prediction e validação humana — ESTRUTURALMENTE CONCLUÍDA

> **O runtime permanece `AI_CORE_UNAVAILABLE`.** Esta etapa constrói a cadeia inteira (`ThermalReading -> features -> gateway -> Prediction -> ThermalIncident -> Alert -> HumanReview -> WorkOrder PREDICTIVE`) e prova, com testes de integração isolados (fetch mockado, banco de teste, limpeza restrita às próprias fixtures), que ela funciona de ponta a ponta. **Nenhuma parte dela foi executada contra o banco demonstrativo.** O FastAPI real deste repositório continua sendo só o preditor mecânico (`DemoPredictor`/`SklearnPredictor`); não existe `/api/v1/thermal/*`. Por isso `thermalAiGateway.checkReadiness()` — chamado de verdade, sem mock, contra o serviço real — sempre e corretamente devolve `ready: false`. Nenhum defeito real está sendo detectado. Isso só acontecerá na Etapa 8.

### Objetivo

Implementar o encadeamento estrutural que torna a IA obrigatória. A aplicação somente poderá classificar risco, abrir incidente de defeito ou produzir alerta preditivo depois de receber uma resposta válida de um modelo carregado. O humano entra depois dessa análise para confirmar ou rejeitar o defeito e decidir a manutenção.

Nesta etapa, o contrato e as invariantes serão implementados. Até a integração do modelo real na Etapa 8, a aplicação deverá permanecer indisponível para operações analíticas; não será permitido usar uma resposta mockada ou um motor de regras para simular a IA.

### Dependências

- Etapa 4 concluída.
- Contrato de dados térmicos estabilizado.

### Tarefas em ordem

#### 5.1. Features temporais rastreáveis

- [x] Média de 5, 15 e 60 minutos.
- [x] Máximo de 1, 6 e 24 horas.
- [x] Tendência em °C/h.
- [x] Minutos acima do limite.
- [x] Leituras consecutivas fora do padrão.
- [x] Tempo desde a última leitura válida.
- [x] Comparação com baseline do ponto e com carga/corrente.
- [x] Persistir versão das transformações para reproduzir cada inferência.

`calculate-temporal-features.ts` (puro, sem Prisma). `THERMAL_FEATURE_VERSION = "thermal-features-v1"`, gravada em toda `Prediction`. Regra anti-vazamento por construção: a função só recebe `current` (a leitura em `measuredAt = T`) e `priorReadings` (measuredAt < T) — nunca lê `initiallyAnomalous`, manifesto de ground truth ou leitura futura, porque esses dados nem são parâmetros aceitos. Janela curta sem amostra devolve `sampleCount: 0`/`value: null`, nunca inventa/interpola (testado explicitamente com espaçamento horário real da Etapa 2). Tendência por regressão linear (mínimos quadrados) sobre a janela de 60 min, não `último - primeiro`. 16 testes unitários.

#### 5.2. Controles de engenharia sem poder de diagnóstico

- [x] Resolver thresholds efetivos.
- [x] Validar plausibilidade, qualidade e dados suficientes.
- [x] Calcular `deltaT`, persistência e flags de segurança como features.
- [x] Rejeitar ou marcar leitura inválida.
- [x] Impedir que thresholds isolados gerem `Prediction`, incidente ou alerta de defeito.
- [x] Usar regras apenas como piso de segurança depois que existir `modelScore` válido.

Reaproveita `thermalSettingsService.resolveForPoint()` da Etapa 3 sem alteração. `quality.sufficientForInference` (baseline com ≥10 amostras + tendência com ≥2 pontos) é calculado pelas features e usado pelo PRÓPRIO gateway para recusar a inferência por dados insuficientes antes de qualquer chamada de rede — nenhum threshold isolado tem, em código, um caminho que crie `Prediction`/incidente/alerta; o único gerador desses três é `thermalOrchestratorService`, sempre a partir de uma resposta validada da IA.

#### 5.3. Gateway obrigatório para a IA

- [x] Criar um único service para solicitar inferência ao FastAPI.
- [x] Exigir readiness com modelo carregado, checksum válido e estágio permitido.
- [x] Enviar leitura, janela, baseline, componente, carga, qualidade e configurações.
- [x] Exigir na resposta `inferenceId`, `modelVersion`, `modelChecksum`, `modelStage`, `modelScore`, `riskScore`, `riskLevel`, `confidence`, provável modo de falha e explicações.
- [x] Validar a resposta com schema estrito.
- [x] Rejeitar `DEMO`, `RULE_ONLY`, versão desconhecida, checksum divergente ou score ausente.
- [x] Em falha, manter a leitura como `AI_FAILED`/`PENDING_AI`, sem classificação operacional.
- [x] Implementar retry e backfill controlados sem duplicar inferências.

`thermal-ai-gateway.service.ts` (`checkReadiness()` + `predictThermal()`) é o ÚNICO ponto do código que faz `fetch` para `/api/v1/thermal/*` — nenhum service de leitura/incidente/alerta chama a rede diretamente. Estágios permitidos (`SYNTHETIC_EXPERIMENTAL`/`PLANT_CALIBRATION`/`PLANT_VALIDATED`) são uma constante fixa em código, não uma variável de ambiente — `EXPECTED_MODEL_STAGE`/`EXPECTED_MODEL_CHECKSUM` só PINAM um valor dentro desse conjunto já fixo, nunca o ampliam; não existe variável capaz de habilitar `DEMO`/`RULE_ONLY`. 14 testes unitários com `fetch` mockado cobrindo cada motivo de falha (`NOT_READY`, `INSUFFICIENT_DATA`, `NETWORK_ERROR`, `TIMEOUT`, `HTTP_ERROR`, `MALFORMED_RESPONSE`, `REQUEST_ID_MISMATCH`, `CHECKSUM_MISMATCH`) e confirmando que a resposta simulada com `RULE_ONLY` é rejeitada pelo mesmo schema estrito da resposta.

Idempotência/retry/backfill: `InferenceRequest` (migration aditiva) com `inferenceRequestId` determinístico (`thermalReadingId:featureVersion`, nunca `crypto.randomUUID()`), `status PENDING/SUCCEEDED/FAILED`, `attemptCount`. `thermalBackfillService` processa em lotes sequenciais (nunca uma chamada simultânea por leitura), interrompe de imediato se a readiness cair no meio da execução, aceita `dryRun`, mostra a quantidade elegível e é seguro de retomar (`pnpm thermal:backfill` / `pnpm thermal:backfill -- --run`). Falha transitória (`NOT_READY`/`INSUFFICIENT_DATA`/`NETWORK_ERROR`/`TIMEOUT`) mantém a `InferenceRequest` `PENDING` para novo lote, até `AI_MAX_RETRIES` tentativas; esgotado o limite (ou falha de contrato como `HTTP_ERROR`/`MALFORMED_RESPONSE`), marca `FAILED` e a leitura `AI_FAILED`.

#### 5.4. `Prediction` termográfica

- [x] Criar `Prediction` somente a partir de resposta autenticada e validada do FastAPI.
- [x] Persistir snapshot da entrada, janela, features, scores, explicações e recomendação.
- [x] Persistir proveniência completa do modelo e um `inferenceId` idempotente.
- [x] Relacionar ponto, leitura e, quando existente, termograma.
- [x] Proibir inserts de `Prediction` pelo frontend, seed demonstrativo ou formulário administrativo.

Migration aditiva: `Prediction.equipmentId` virou anulável (predição térmica pode vir de um ponto cujo painel não tem Equipment real — nunca inventamos um) + `inferenceId` (`@unique`), `inferenceRequestId`, `featureVersion`, `modelChecksum`, `predictedFailureMode`, `failureModeConfidence`. `inputSnapshot`/`featuresUsed` (já existentes desde a Etapa 1) recebem o payload enviado à IA e o objeto de features completo. `ANALYZED` só é setado depois que a `Prediction` foi persistida com sucesso, na MESMA transação (`thermal-orchestrator.service.ts`). Nenhuma action pública cria `Prediction` — confirmado por auditoria de código; o único caminho é `thermalOrchestratorService.processInferenceRequest()`.

#### 5.5. Incidente consolidado originado pela IA

- [x] Buscar incidente ativo do ponto somente depois de uma `Prediction` elegível.
- [x] Criar o incidente com referência obrigatória à inferência que o originou.
- [x] Atualizar pico, contagem e evidências quando novas predições confirmarem persistência.
- [x] Escalar severidade sem abrir alertas duplicados.
- [x] Implementar histerese e normalização usando resultados posteriores da IA.
- [x] Nunca representar falta de inferência como estado normal.

`ThermalIncident.triggerPredictionId` agora obrigatório e único (migration aditiva; enum `IncidentStatus` ganhou `PENDING_HUMAN_REVIEW`/`HUMAN_CONFIRMED`/`HUMAN_REJECTED`/`INCONCLUSIVE`/`NEW_READING_REQUIRED` — valores legados `OPEN`/`ACKNOWLEDGED`/`UNDER_ANALYSIS`/`DISMISSED` preservados sem uso pelo fluxo novo). `thermal-incident.service.ts`: `CRITICAL` abre imediatamente, `HIGH` exige 2 predições consecutivas ≥HIGH, `MODERATE` exige 3, `LOW` nunca abre incidente. Concorrência protegida por `pg_advisory_xact_lock(hashtext(thermalPointId))` dentro da transação — nunca um `findFirst()`/`create()` desprotegido. `[~]` Histerese/normalização automática por decaimento de score: implementada só a parte "nunca normaliza sem nova inferência válida" (não existe nenhum caminho que feche incidente por queda brusca de temperatura ou ausência de leitura); a transição para `NORMALIZED` em si depende de fluxo de monitoramento pós-ação que é da Etapa 10.

#### 5.6. Decisão humana sobre o defeito

- [x] Substituir o simples "Reconhecer" por "Reconhecer/confirmar defeito".
- [x] Oferecer `CONFIRMED`, `REJECTED`, `INCONCLUSIVE` e `NEW_READING_REQUIRED`.
- [x] Exigir justificativa para rejeição, inconclusão ou alteração da causa/severidade sugerida.
- [x] Registrar usuário, horário, decisão, justificativa e versão da análise revisada.
- [x] Tratar a decisão humana como feedback supervisionado futuro, nunca como substituto da inferência de origem.

Novo modelo `HumanReview` (histórico imutável — nunca sobrescreve uma decisão anterior; `ThermalIncident.humanReviewDecision/reviewedAt/reviewedById` guarda só o snapshot mais recente). Schema Zod exige justificativa para tudo que não seja `CONFIRMED`. `humanReviewService.submit()` + `submitHumanReviewAction` (reaproveita a permissão `incident:diagnose`, já existente desde a Etapa 1 — nenhuma permissão nova foi necessária). Interface (botões) é Etapa 6; backend completo, testado e sem tela nenhuma preenchida com incidente fictício.

#### 5.7. Alerta e OS sem bypass

- [x] Relacionar alerta ao incidente e à `Prediction` que o originou.
- [x] Notificar apenas abertura e escalada geradas pela IA.
- [x] Permitir OS preditiva somente após `CONFIRMED` por usuário autorizado.
- [x] Remover criação de OS preditiva diretamente de alerta ainda não confirmado.
- [x] Copiar contexto térmico, provável causa, confiança, explicações e proveniência do modelo.
- [x] Permitir ao humano escolher a ação, prioridade final, responsável e agendamento.
- [x] Registrar toda confirmação e conversão na auditoria.

`thermal-alert.service.ts`: um `Alert` por `ThermalIncident` (nunca um por leitura), `triggerCount`/`peakTemperatureC`/`peakDeltaTC` atualizados na escalada, `escalatedAt` só quando a severidade realmente sobe. Sem notificação externa (fila interna já é suficiente para esta etapa, conforme o próprio prompt). `predictiveWorkOrderService.createFromConfirmedIncident()` — fluxo NOVO e SEPARADO de `alertService.convertToWorkOrder()` (mecânico, preservado sem nenhuma alteração de comportamento) — exige incidente `HUMAN_CONFIRMED`, sem OS anterior, com `Prediction` de origem, e núcleo de IA não `AI_CORE_UNAVAILABLE`; migration aditiva `WorkOrder.thermalPointId` para rastreabilidade direta ponto→OS. Auditoria em `submitHumanReviewAction`/`createPredictiveWorkOrderFromIncidentAction`.

#### 5.8. Bloqueio por indisponibilidade da IA

- [x] Criar estado global `AI_CORE_UNAVAILABLE`.
- [x] Bloquear rotas e mutations operacionais quando readiness falhar.
- [x] Permitir somente autenticação, diagnóstico técnico, auditoria e retenção de telemetria pendente.
- [x] Exibir mensagem inequívoca de que nenhuma análise está ativa.
- [x] Não mostrar o último risco como se ainda fosse atual sem indicar sua idade.

`aiCoreStateService.getState()` (`READY`/`DEGRADED`/`AI_CORE_UNAVAILABLE`) é a fonte única — `DEGRADED` é calculado com sinal real (taxa de falha das últimas tentativas de `InferenceRequest`), não estimado. Os dois únicos caminhos capazes de criar resultado analítico já são bloqueados no servidor: `thermalOrchestratorService` (via `predictThermal()`, que recusa antes de qualquer criação) e `predictiveWorkOrderService` (via `aiCoreStateService`). Ingestão de leitura, consulta de histórico e revisão humana sobre evidência já existente continuam funcionando sem a IA. A Etapa 6 concluiu também a mensagem visível e a idade da última inferência.

### Testes da etapa

- [x] modelo ausente não cria `Prediction`, incidente, alerta ou OS preditiva — testado (unitário do gateway + integração fail-closed);
- [x] resposta com `RULE_ONLY`/`DEMO` é rejeitada — testado (schema + gateway);
- [x] resposta sem proveniência ou com checksum inválido é rejeitada — testado;
- [x] `Prediction` válida cria ou atualiza um único incidente — testado (integração, cadeia positiva);
- [x] leituras repetidas atualizam o mesmo incidente — deduplicação, lock e escalada estão implementados e cobertos pela integração isolada; ensaio E2E contínuo permanece na Etapa 11;
- [x] humano confirma, rejeita ou pede nova leitura com auditoria — testado (`CONFIRMED` na integração; `REJECTED`/`INCONCLUSIVE`/`NEW_READING_REQUIRED` exigindo justificativa no schema);
- [x] tentativa de criar OS antes da confirmação retorna erro — testado (segunda chamada ao criar OS para o mesmo incidente já `WORK_ORDER_CREATED` rejeitada; `createFromConfirmedIncident` valida `status/humanReviewDecision` antes de qualquer escrita);
- [x] tentativa de criar OS preditiva manual retorna erro — testado (schema genérico continua rejeitando `PREDICTIVE`, reconfirmado nesta etapa);
- [~] normalização depende de novas inferências válidas — coberto conceitualmente (nenhum caminho normaliza sem IA), não há teste de um ciclo completo até `NORMALIZED` (depende de monitoramento pós-ação da Etapa 10);
- [x] indisponibilidade do FastAPI bloqueia o fluxo operacional — testado (integração fail-closed contra readiness real "sklearn").

Cobertos por 91 testes unitários novos (features temporais, os dois schemas de contrato da IA, gateway com `fetch` mockado, schema de revisão humana) + 3 testes de integração reais contra o PostgreSQL (`thermal-ai-orchestration.integration.test.ts`: fail-closed, cadeia positiva completa até OS preditiva, bloqueio do formulário genérico) + 2 testes de integração da Etapa 1 estendidos para o novo `triggerPredictionId` obrigatório.

### Critério de saída

- [x] A cadeia obrigatória é `Reading -> IA -> Prediction -> Incident -> HumanReview -> WorkOrder` — implementada e comprovada por teste de integração de ponta a ponta.
- [x] Nenhum resultado analítico pode nascer de mock, seed, threshold isolado ou formulário manual — auditoria de código confirma um único caminho de criação para cada modelo (`Prediction`: `thermalOrchestratorService`; `ThermalIncident`/`Alert`: `thermalIncidentService`/`thermalAlertService`, sempre a partir de uma `Prediction`; `WorkOrder.PREDICTIVE` térmica: `predictiveWorkOrderService`).
- [x] O caso de 75,6 °C só poderá abrir incidente depois da inferência real integrada na Etapa 8 — confirmado: `Prediction.total = 0` no banco demonstrativo depois de toda a implementação e todos os testes desta etapa (ver validação do banco abaixo).
- [x] O humano controla a decisão de reconhecer o defeito e a ação de manutenção — `humanReviewService` + `predictiveWorkOrderService`, testados.
- [x] A remoção/indisponibilidade da IA interrompe o núcleo operacional do aplicativo — confirmado contra o FastAPI real (sem mock): `checkReadiness()` devolve `ready:false` porque o preditor ativo é `sklearn`/`demo`, nunca `thermal`.

### Commits sugeridos

```text
feat(ai-core): enforce fail-closed thermal inference
feat(incidents): require AI provenance for thermal incidents
feat(human-review): add audited defect confirmation workflow
feat(work-orders): require confirmed AI analysis for predictive orders
```

---

## Etapa 6 — Interface operacional termográfica

> **09/09/2026 — encerrada no escopo pré-Etapa 9:** além da implementação original, o deploy foi validado em desktop por capturas fornecidas pelo usuário, incluindo dashboard, detalhe TP-037, gráficos temporais e evidência real do modelo. O fechamento corrigiu os rótulos de confiança/score, traduziu hipóteses de falha e tornou o eixo dos gráficos proporcional ao tempo. Validação mobile/teclado e E2E versionado permanecem na Etapa 11, sem bloquear telemetria.

### Objetivo

Construir a experiência principal para planejador, técnico e gestor consumindo exclusivamente registros reais do PostgreSQL e resultados rastreáveis da IA. A interface poderá ser estruturada antes do modelo final, mas não poderá usar mocks, arrays hardcoded ou severidade calculada no frontend; as telas analíticas permanecerão em `PENDING_AI`/`AI_CORE_UNAVAILABLE` até a Etapa 8.

### Dependências

- Etapa 5 concluída.

### Rotas prioritárias

```text
/thermal-monitoring
/thermal-monitoring/points/[id]
/thermal-incidents
/thermal-incidents/[id]
/electrical-panels
/electrical-panels/[id]
/sensor-devices
/settings/thermal-risk
```

### Tarefas em ordem

#### 6.1. Navegação

- [x] Adicionar “Monitoramento térmico” à sidebar.
- [x] Adicionar “Incidentes térmicos”.
- [x] Adicionar “Painéis elétricos”.
- [x] Manter PCM/OS acessível.
- [x] Manter somente as partes do PCM que funcionam como consequência da análise e da decisão humana.
- [x] Remover/ocultar o dashboard preditivo mecânico e fluxos genéricos que permitam demonstrar valor sem IA.
- [x] Tornar o monitoramento térmico baseado em IA a tela principal após o login.

#### 6.2. Dashboard dos 55 pontos

- [x] Total monitorado.
- [x] Normais.
- [x] Atenção.
- [x] Altos.
- [x] Críticos.
- [x] Sem comunicação.
- [x] Incidentes abertos.
- [x] Maior temperatura.
- [x] Maior `deltaT`.
- [x] Tendência mais rápida.
- [x] Última atualização.
- [x] Estado e idade da última inferência.
- [x] Quantidade de leituras `PENDING_AI`/`AI_FAILED`.
- [x] Obter normal/atenção/alto/crítico somente da última `Prediction` válida.

#### 6.3. Mapa/lista hierárquica

- [x] Filtrar por setor.
- [x] Filtrar por equipamento.
- [x] Filtrar por painel.
- [x] Filtrar por componente.
- [x] Filtrar por severidade.
- [x] Filtrar por conectividade.
- [x] Destacar os 19 pontos originalmente anormais.
- [x] Separar visualmente o fato histórico “19 originalmente anormais” do estado atual inferido pela IA.
- [x] Permitir acesso ao detalhe em um clique.

#### 6.4. Detalhe do ponto

- [x] Cabeçalho com identificação e estado.
- [x] Temperatura atual, referência e `deltaT`.
- [x] Tendência e persistência.
- [x] Gráfico com limites.
- [x] Carga/corrente no mesmo intervalo.
- [x] Predições e explicações.
- [x] Provável modo de falha, confiança, versão e checksum do modelo.
- [x] Incidentes e OS.
- [x] Configuração e calibração.
- [x] Estado do dispositivo.

#### 6.5. Tela de incidente

- [x] Linha do tempo.
- [x] Pico e evolução.
- [x] Explicações.
- [x] Ação sugerida.
- [x] Botões “Confirmar defeito”, “Rejeitar”, “Inconclusivo” e “Solicitar nova leitura”.
- [x] Justificativa e trilha da revisão humana.
- [x] Conversão em OS somente depois de confirmação humana.
- [~] Monitoramento pós-ação — base de visualização pronta; encerramento/normalização pertence à Etapa 10.

#### 6.6. Responsividade e estados

- [x] Loading skeleton.
- [x] Empty state.
- [x] Error boundary.
- [x] Estado de serviço analítico indisponível.
- [x] Bloqueio operacional quando o modelo não estiver pronto, sem preencher a tela com valores fictícios.
- [~] Mobile para telas de consulta e decisão humana sobre o defeito — classes responsivas implementadas; validação visual automatizada pertence à Etapa 11.

### Testes da etapa

- renderização com 55 pontos;
- filtros combinados;
- ponto sem leitura;
- sensor offline;
- incidente crítico;
- confirmação e rejeição humana;
- bloqueio de OS antes da confirmação;
- acessibilidade básica de cores e labels;
- responsividade.

### Critério de saída

- [x] O usuário encontra o ponto crítico em poucos passos.
- [x] O dashboard não esconde criticidade em médias gerais.
- [x] É possível entender por que o alerta foi aberto.
- [x] Todo resultado exibido é rastreável a uma linha do banco e a uma inferência real.
- [x] Todo o fluxo operacional pode ser feito pela interface depois que o modelo real estiver saudável.
- [x] Sem IA, a interface não oferece diagnóstico alternativo nem cria OS preditiva — gates de apresentação e servidor cobertos por testes; demonstração visual ainda pendente.

### Commits sugeridos

```text
feat(ui): add thermal monitoring dashboard
feat(ui): add thermal point detail
feat(ui): add thermal incident workflow
```

---

## Etapa 7 — Dataset sintético temporal

**Atualização de 08/09/2026:** pipeline offline concluído e reproduzível. O manifesto final tem SHA-256 `8b948e4e4f64bd6fce386f4f2876f777aa48f43ee4a9d20c0d1b2bd2adb8cd98`; o cenário reservado foi validado pelo carregador real em dry-run, sem alterar o banco demonstrativo já populado. A escrita e o processamento ponta a ponta ficam deliberadamente para um banco isolado e para o modelo da Etapa 8. Prompt executado: `docs/prompts/etapa-7-dataset-termico-temporal.md`.

### Objetivo

Gerar um dataset reproduzível e fisicamente coerente para treinar um modelo termográfico experimental sem misturar o problema antigo do AI4I.

Esse dataset não é um mock do aplicativo. Ele será produzido por um simulador de processos térmicos; uma parte alimentará o pipeline de treino e um cenário reservado, com seed e período distintos, será aplicado ao PostgreSQL pelo fluxo real de ingestão para a demonstração ponta a ponta.

### Dependências

- Contrato de dados das Etapas 1–5 estabilizado.
- Features térmicas e contrato obrigatório de inferência das Etapas 1–5 estabilizados.

### Arquivos principais

```text
services/predictive-ai/training/
├── generate_thermal_dataset.py
├── build_thermal_windows.py
├── load_thermal_scenario_to_db.py
├── evaluate_thermal_models.py
└── compare_rule_and_ml.py
```

### Tarefas em ordem

#### 7.1. Definir contrato do dataset

- [x] Definir unidade e nome de cada coluna.
- [x] Definir targets.
- [x] Definir horizonte de 24 h e 7 dias.
- [x] Definir intervalo de amostragem — 30 minutos, permitindo medir a tendência de 60 min com a semântica estrita da Etapa 5.
- [x] Definir duração simulada.
- [x] Definir seeds globais reproduzíveis.
- [x] Definir distribuição por tipo de componente.
- [x] Definir seeds e períodos diferentes para treino, validação, teste e demonstração no banco.

#### 7.2. Gerar condições normais

- [x] Ciclo diário do ambiente.
- [x] Turnos de produção.
- [x] Variação de carga.
- [x] Aquecimento após acionamento.
- [x] Resfriamento após parada.
- [x] Baseline próprio por componente.
- [x] Ruído e qualidade de sensor.
- [x] Pequenas falhas de comunicação.

#### 7.3. Gerar falhas plausíveis

- [x] Conexão frouxa/resistência elevada.
- [x] Sobrecarga.
- [x] Desequilíbrio de fases.
- [x] Contato degradado.
- [x] Ventilação insuficiente.
- [x] Relé degradado.
- [x] Erro de sensor como classe separada.
- [x] Recuperação após manutenção.

#### 7.4. Reproduzir o desafio

- [x] Criar 55 identidades persistentes.
- [x] Criar episódios anormais em 19 pontos.
- [x] Incluir uma única ocorrência do pico de 75,6 °C contra 40 °C (ΔT 35,6 °C).
- [x] Evitar replicar o mesmo exemplo milhares de vezes.
- [x] Garantir variedade de carga, ambiente, causa e duração.
- [x] Reservar a série usada na demonstração; ela não participa do treino.
- [x] Aplicar o cenário demonstrativo ao banco via service real, sem insert de resultados da IA — o ciclo sincronizado persistiu telemetria bruta e processou as leituras atuais pelo artefato real; o carregador histórico integral permanece uma ferramenta opcional.

#### 7.5. Criar features temporais

- [x] Janelas móveis.
- [x] Tendência.
- [x] Persistência.
- [x] Comparação com baseline.
- [x] Comparação entre fases/referências.
- [x] Interações com carga.
- [x] Indicadores de qualidade.

#### 7.6. Separar dados corretamente

- [x] Split cronológico.
- [x] Reservar pontos/painéis no teste.
- [x] Evitar vazamento de target.
- [x] Manter teste final intocado durante seleção/comparação.
- [x] Salvar manifesto e hash.

#### 7.7. Validar o gerador

- [x] Plotar amostras normais e de cada cenário de falha.
- [x] Verificar correlações das features com o target.
- [x] Verificar distribuição de classes.
- [x] Confirmar que regra simples e baseline ML não reconstroem perfeitamente o target.
- [x] Criar testes de reprodutibilidade e causalidade temporal.
- [x] Confirmar que o `ground truth` não é consultado pelo FastAPI durante a inferência.
- [x] Confirmar que o frontend não importa arquivos do gerador nem metadados de rótulo.

### Critério de saída

- [x] Dataset pode ser regenerado com o mesmo hash — duas execuções consecutivas produziram `8b948e4e...cd98`.
- [x] Cenários normais e anormais têm gráficos auditáveis e amostras representativas revisadas.
- [x] Split não mistura futuro no passado.
- [x] Os 55/19 e o caso crítico estão presentes.
- [x] O cenário demonstrativo pode ser carregado pelo service real sem mocks; o ciclo sincronizado atual persistiu 13 medições para cada um dos 55 pontos e submeteu as 55 leituras atuais ao artefato ML. A carga histórica integral do CSV reservado continua opcional e não é requisito para telemetria.
- [x] Nenhuma saída esperada foi hardcoded na aplicação.
- [x] Manifesto informa claramente que os dados são sintéticos e não provam eficácia industrial.

### Commits sugeridos

```text
feat(ml-data): add synthetic thermal time-series generator
feat(ml-data): build leakage-safe temporal windows
test(ml-data): validate synthetic scenario reproducibility
```

---

## Etapa 8 — Treinamento termográfico e integração FastAPI

**Atualização de 08/09/2026:** treinamento, artefato, validação, FastAPI térmico e gateway real concluídos em código. Random Forest calibrada venceu os candidatos; o artefato ativo tem checksum `sha256:ded7ae6e80dbadefe0c2fd5419a0603c975f67b8f295299abb2b34c01f690468` e fingerprint semântico reproduzível `sha256:a65fad10ce8cd3333ac08f1134f59c1399a2f337637a9151881178ff55d3805d`. A carga de 7.186 leituras reservadas e a Prediction persistida ficaram pendentes porque a revisão automática recusou a mutação ampla no banco compartilhado sem autorização específica. Prompt executado: `docs/prompts/etapa-8-treinamento-integracao-fastapi.md`.

### Objetivo

Treinar, avaliar e integrar o novo modelo termográfico como dependência obrigatória do aplicativo. Regras de engenharia poderão complementar uma inferência válida e servir como baseline de comparação, mas não existirá predictor alternativo capaz de manter o fluxo operacional sem Machine Learning.

### Dependências

- Etapa 7 concluída.

### Tarefas em ordem

#### 8.1. Baselines

- [x] Avaliar somente regras como experimento offline de comparação, nunca como runtime.
- [x] Avaliar Logistic Regression.
- [x] Registrar resultados por tipo de componente.
- [x] Registrar falsos alertas por ponto/dia.

#### 8.2. Modelos candidatos

- [x] Random Forest.
- [x] Gradient Boosting.
- [x] Isolation Forest para anomalia complementar, nunca autônoma.
- [x] Calibração sigmoide do score supervisionado.
- [x] Escolher por PR-AUC, ROC-AUC, F1, recall e Brier, nunca accuracy isolada.

#### 8.3. Metadados e artefato

- [x] Salvar `thermal_model.joblib`.
- [x] Criar novo `metadata.json` e preservar metadados mecânicos como histórico inativo.
- [x] Registrar `SYNTHETIC_EXPERIMENTAL`.
- [x] Registrar features, target, horizonte e hashes distintos.
- [x] Gerar e validar checksum bruto do artefato e fingerprint semântico do retreino.
- [x] Definir geração obrigatória durante build controlado como estratégia recuperável.

#### 8.4. Novo contrato FastAPI

- [x] Criar schemas térmicos de entrada e saída estritos.
- [x] Criar `ThermalMlPredictor`.
- [x] Criar detector de anomalia temporal, classificador supervisionado e classificador de causa.
- [x] Criar ensemble em que o modelo supervisionado válido é sempre obrigatório.
- [x] Aplicar piso de segurança de engenharia somente depois de obter `modelScore` válido.
- [x] Estimar provável modo de falha e sua confiança para revisão humana.
- [x] Retornar explicações.
- [x] Expor estágio e origem sintética.
- [x] Remover `DemoPredictor` e desativar o endpoint mecânico legado; não há retorno `RULE_ONLY`.
- [x] Reprovar readiness e predict se artefato, metadados ou checksum estiverem ausentes/inválidos.

#### 8.5. Integração Next.js

- [x] Desativar definitivamente `predictive-ai.client.ts` mecânico e reutilizar o gateway térmico único.
- [x] Enviar leitura, janela, baseline e thresholds reais.
- [x] Validar resposta com Zod estrito.
- [x] Persistir scores, explicações e proveniência pelo orquestrador transacional.
- [x] Tratar indisponibilidade sem perder leitura, mantendo-a `PENDING_AI`/`AI_FAILED` e sem criar resultado substituto.
- [x] Reutilizar retry/backfill controlado e idempotente da Etapa 5.
- [x] Bloquear incidentes, alertas de defeito, relatórios analíticos e OS preditivas enquanto a IA estiver indisponível.

#### 8.6. Health check

- [x] Exibir o modelo ML ativo; nenhum tipo `demo` ou `rule-only` é aceito como ready.
- [x] Exibir versão.
- [x] Exibir estágio.
- [x] Exibir se é sintético.
- [x] Validar checksum.
- [x] Retornar readiness não saudável quando não houver modelo utilizável.
- [x] Não expor segredos ou caminhos sensíveis.

### Testes da etapa

- endpoint com cenário normal;
- endpoint com crítico 75,6/40;
- piso crítico de engenharia só é aplicado depois de inferência ML válida;
- modelo ausente retorna indisponibilidade e não produz predição;
- produção falha claramente sem modelo;
- schema inválido retorna 422;
- resposta contém explicação;
- integração completa cria `Prediction` com proveniência;
- execução sobre a série reservada do banco produz resultados sem consultar o `ground truth`;
- remoção do `.joblib` reprova readiness e bloqueia o aplicativo.

### Critério de saída

- [x] O FastAPI executa o modelo térmico — validado por TestClient e HTTP real via gateway TypeScript.
- [x] O frontend possui apresentação de `SYNTHETIC_EXPERIMENTAL` e o banco demonstrativo contém Prediction persistida real para o TP-039.
- [x] O fluxo operacional não funciona sem o modelo e não existe fallback por regras.
- [x] O cenário demonstrativo está carregado; o TP-039 possui leitura analisada, Prediction rastreável e incidente crítico fresco para revisão humana.
- [x] O contrato e o orquestrador persistiram `inferenceId`, versão, checksum, estágio e snapshot no caso oficial.
- [x] Métricas antigas foram movidas para histórico inativo e não aparecem como validação termográfica.
- [x] O artefato é recuperável em instalação limpa pelo comando de treinamento documentado e validado por checksum.

### Commits sugeridos

```text
feat(ml): train thermal risk models
feat(api): add thermal prediction contract
feat(integration): connect thermal risk engine to PCM
```

---

## Adequação transversal — prontidão da demonstração e preparação de deploy — CONCLUÍDA

Execução de 09/09/2026 do prompt `docs/prompts/prontidao-demonstracao-e-deploy.md`. Esta entrega não declara as Etapas 9–11 integralmente concluídas; fecha somente o caminho necessário para demonstrar com segurança o caso já implementado e prepara o empacotamento do próximo deploy.

### Entregas

- [x] `pnpm demo:verify` somente leitura, com falha explícita quando configuração, IA, banco, TP-039, proveniência, equipamento ou estado fresco do incidente não atendem ao roteiro.
- [x] Caso oficial comprovado no banco: 55 pontos, 19 marcadores reservados, TP-039 em 75,6 °C/ΔT 35,6 °C, score 85, Prediction rastreável e incidente `PENDING_HUMAN_REVIEW` sem OS.
- [x] Dockerfile construído a partir da raiz do monorepo, treinando e validando o `.joblib` ignorado pelo Git antes de iniciar o FastAPI.
- [x] `.dockerignore` impede envio de segredos, ambientes locais, dependências Node, caches e dados brutos desnecessários.
- [x] Um único cron Vercel diário em `/api/cron/daily-maintenance`, reunindo scheduler preventivo e lote térmico com isolamento de falhas.
- [x] Endpoints antigos de cron preservados apenas para compatibilidade/manual, sem agendamento automático.
- [x] Testes unitários cobrem autenticação, chamada única das duas rotinas, resposta estruturada e comportamento fail-closed.

### Limites deliberados

- O backlog térmico não é processado integralmente nesta entrega; ele aparece como aviso no pré-voo e o cron continua em lotes limitados/idempotentes.
- Revisão humana e OS não são criadas pelo verificador: esses registros auditáveis ficam reservados para a apresentação.
- Repetição integral exige outro banco/branch demonstrativo; não existe limpeza automática de histórico.
- Telemetria física, relatórios antes/depois, feedback técnico completo, E2E visual versionado e piloto real mantêm seus escopos nas Etapas 9–12.
- O build Docker real não pôde ser executado na sessão porque o comando `docker` não está instalado; treino/validação local, testes Python e validação estática do contexto são as verificações disponíveis até o deploy.

---

## Etapa 9 — Dispositivos e telemetria contínua

### Objetivo

Compatibilizar primeiro o domínio com o processo de inspeção da empresa e, em seguida, substituir a dependência de registros manuais por um canal seguro e idempotente de dados contínuos. Manual, CSV e termograma continuam como origens válidas de inspeção; independentemente da origem, toda interpretação atual deverá passar pelo mesmo modelo de IA.

### Dependências

- Etapa 8 concluída.
- Gestão básica de dispositivos da Etapa 3 funcionando.

### Tarefas em ordem

#### 9.0. Escala empresarial e inspeção original — concluída em 09/09/2026

- [x] Criar enum próprio `CompanyThermalPriority` com `P5`, `P10`, `P20`, `P30`, `P50` e `P100`.
- [x] Não substituir `RiskLevel` da IA: risco atual (`LOW`/`MODERATE`/`HIGH`/`CRITICAL`), prioridade empresarial e prioridade da OS são conceitos distintos.
- [x] Criar `ThermalInspection` e `ThermalInspectionFinding`, ou estrutura equivalente, para registrar data, origem, responsável, ponto/TAG, leitura, referência documental do termograma, rótulo original da inspeção, prioridade empresarial, recomendação e observação. O objeto privado do termograma permanece corretamente na Etapa 10.
- [x] Tornar o registro da inspeção original imutável/auditável; `initiallyAnomalous` poderá permanecer apenas como campo legado derivado, nunca como única evidência.
- [x] Registrar no cenário reservado exatamente 2 achados “Prioridade 3 (P20)”, 10 “Prioridade 4 (P10)” e 7 “Prioridade 5 (P5)”; o `TP-039` pertence ao grupo P20 e o segundo P20 está explicitamente marcado como mapeamento demonstrativo pendente da fonte oficial.
- [x] Exibir lado a lado **prioridade histórica da inspeção**, **risco atual da IA** e **prioridade final escolhida pelo humano**.
- [x] Criar política versionada de conversão entre risco/evidência e prioridade empresarial; `P30`, `P50` e `P100` existem, mas ficam sem prazo/ação até validação formal da empresa.
- [x] Copiar a prioridade empresarial confirmada e a versão da política para o incidente, revisão, alerta, OS e relatório da OS, preservando o valor usado na decisão.
- [x] Testar a distribuição `2/10/7`, a separação semântica e a impossibilidade de o frontend usar a prioridade histórica como risco atual.

#### 9.1. Contrato de telemetria

- [x] Criar `POST /api/v1/telemetry/thermal-readings`.
- [x] Aceitar lote.
- [x] Definir limite de itens e payload.
- [x] Validar timestamps.
- [x] Validar `thermalPointCode` autorizado.
- [x] Responder por item.
- [x] Enfileirar cada leitura aceita para processamento pelo núcleo de IA.
- [x] Confirmar recebimento rapidamente e processar por fila durável: PostgreSQL é a fonte de verdade e um gatilho idempotente do Vercel Queues acorda o consumidor separado.
- [x] Nunca retornar risco ou severidade calculados pela rota de ingestão.

#### 9.2. Segurança de dispositivo

- [x] Autenticação própria, separada de Auth.js.
- [x] Chave individual.
- [x] Hash no banco.
- [x] Rotação e revogação.
- [x] Rate limiting.
- [x] Proteção contra replay.
- [x] Auditoria de falhas.

#### 9.3. Idempotência e reconexão

- [x] Usar `deviceId + sequence`.
- [x] Aceitar lote atrasado.
- [x] Não duplicar leitura.
- [x] Não reenviar notificações históricas por padrão; a Etapa 9 registra apenas alerta interno consolidado e não possui envio externo.
- [x] Atualizar `lastSeenAt` com leitura válida.

#### 9.4. Estado do sensor

- [x] Online.
- [x] Offline.
- [x] Degradado.
- [x] Em manutenção.
- [x] Desabilitado.
- [x] Gerar alerta técnico após persistência.
- [x] Nunca representar ausência de leitura como normalidade.

#### 9.5. Gateway de demonstração

- [x] Criar simulador externo de dispositivo.
- [x] Enviar sequência contínua.
- [x] Simular perda de rede e buffer.
- [x] Simular reconexão em lote.
- [x] Simular pico crítico.
- [x] Documentar contrato independente de fabricante para gateway industrial futuro; ESP32, MQTT ou câmera específica permanecem opções de implementação, não requisitos do desafio.

#### 9.6. Escalabilidade inicial

- [x] Testar 55 leituras/minuto.
- [x] Testar 79.200 leituras/dia simuladas.
- [x] Medir latência de validação/serialização por lote; o soak de latência ponta a ponta do deployment permanece na Etapa 11.
- [x] Evitar uma chamada FastAPI síncrona por item no recebimento de lote: a rota publica um gatilho e o consumidor processa com concorrência limitada.
- [x] Implementar fila/worker durável: fila PostgreSQL com lease/`SKIP LOCKED` mais consumidor Vercel Queues; o cron diário ficou apenas para reconciliação, retenção e recuperação.
- [x] Dimensionar o consumidor acima da entrada nominal e expor métricas de backlog; a confirmação sustentada em produção será executada no soak da Etapa 11.
- [x] Definir retentativa automática com backoff e fila de erro recuperável para `AI_FAILED`, sem fabricar resultado e sem exigir correção manual linha a linha.
- [x] Garantir que o worker use o mesmo contrato, modelo e validação de proveniência do fluxo individual.

### Critério de saída

- [x] A inspeção original mostra exatamente 19 achados: `2 × P20`, `10 × P10` e `7 × P5`, separada do estado atual da IA.
- [x] A aplicação reconhece toda a escala `P5`–`P100` sem inventar o significado empresarial dos níveis ainda não documentados.
- [x] Gateway simulado envia dados continuamente.
- [x] Duplicatas são ignoradas.
- [x] Queda e retorno de rede preservam dados no buffer e o reenvio é idempotente.
- [x] Sensor offline é identificado.
- [x] Todas as leituras aceitas ficam `PENDING_AI`, `ANALYZED` ou `AI_FAILED`, sem classificação alternativa.
- [x] A fila foi dimensionada para 55 leituras/minuto e o contrato de 79.200/dia foi exercitado; falhas possuem retentativa e diagnóstico auditável. O soak no deployment continua como aceitação da Etapa 11.
- [x] O dashboard reflete telemetria com consultas limitadas e atualização automática a cada 60 segundos.

### Evidências de encerramento da Etapa 9 — 09/09/2026

- migrações aditivas aplicadas no Neon, sem reset: prioridade, inspeção/achados, credenciais, fila, auditoria, alertas técnicos e índices de retenção;
- verificação do banco: 19 achados imutáveis, distribuição `P5=7`, `P10=10`, `P20=2` e `TP-039 = Prioridade 3/P20`;
- teste de capacidade: 55 pontos, 79.200 leituras/dia, 825 envelopes, maior payload de 25.056 bytes e p95 local final de validação/serialização de 0,201 ms;
- teste PostgreSQL real: autenticação individual, persistência atômica `ThermalReading + InferenceRequest`, reenvio idempotente e lote atrasado/autorização por ponto;
- suíte completa: 353 testes unitários/contratuais aprovados, 3 testes PostgreSQL da Etapa 9 aprovados, lint/typecheck e build Next.js de produção aprovados;
- `@vercel/queue` e consumidor `thermal-analysis` configurados no serviço web; nenhuma credencial manual de fila é adicionada ao `.env`.

### Commits sugeridos

```text
feat(telemetry): add authenticated thermal batch ingestion
feat(devices): add connectivity and offline detection
test(load): validate 55-point telemetry volume
```

---

## Etapa 10 — Relatórios, diagnóstico e feedback operacional

### Objetivo

Cruzar inspeção, termograma, TAG, histórico, inferência, prioridade empresarial, decisão humana e manutenção; fechar o ciclo operacional e preparar dados úteis para futuro treinamento com dados reais.

### Dependências

- Etapas 6–9 concluídas.

### Tarefas em ordem

#### 10.0. Evidência por termograma e histórico de inspeções — requisito do desafio

- [ ] Implementar upload/ingestão do arquivo termográfico para leitura manual, CSV enriquecido ou câmera/gateway compatível.
- [ ] Armazenar o arquivo em storage privado; o banco guarda chave interna, MIME validado, dimensões, temperaturas, ROI, captura, autor/dispositivo e checksum.
- [ ] Validar tipo real e tamanho, impedir execução de conteúdo e aplicar autorização no download/visualização.
- [ ] Vincular cada termograma a `ThermalInspectionFinding`, `ThermalReading`, `ThermalPoint` e, por consequência, ao TAG/painel/equipamento.
- [ ] Exibir imagem, ROI/metadados, leitura numérica, histórico de recomendações e Prediction correspondente na mesma linha do tempo.
- [ ] Não exigir visão computacional avançada no primeiro piloto: a IA temporal pode consumir as medições extraídas pela câmera; análise de pixels só entra mediante dataset e aceite próprios.

#### 10.1. Relatórios

- [ ] Relatório por ponto.
- [ ] Relatório do painel.
- [ ] Relatório consolidado dos 55 pontos.
- [ ] Relatório de incidente.
- [ ] Antes/depois da intervenção.
- [ ] Marca visível de dados sintéticos.
- [ ] Versão/checksum do modelo e `inferenceId` das análises relevantes.
- [ ] Separação entre diagnóstico sugerido pela IA e decisão registrada pelo humano.
- [ ] Mostrar prioridade histórica P5–P100, prioridade recomendada atual, prioridade final e política/versionamento usados.

#### 10.2. Diagnóstico técnico

- [ ] Exigir confirmação/rejeição humana antes da criação de OS preditiva.
- [ ] Exigir causa encontrada ao concluir OS relacionada.
- [ ] Registrar se a anomalia e o modo de falha sugeridos pela IA foram confirmados.
- [ ] Registrar ação executada.
- [ ] Registrar componente afetado.
- [ ] Registrar temperatura pós-ação.
- [ ] Validar que a OS pertence ao mesmo equipamento/ponto.
- [ ] Exigir prioridade empresarial final e justificativa quando o humano divergir da recomendação versionada.

#### 10.3. Monitoramento pós-ação

- [ ] Iniciar janela após conclusão.
- [ ] Comparar baseline anterior e novo.
- [ ] Detectar reincidência.
- [ ] Permitir normalização validada.
- [ ] Reabrir se a condição retornar.

#### 10.4. Dataset real futuro

- [ ] Criar exportação controlada.
- [ ] Relacionar leitura, incidente, OS e causa.
- [ ] Não treinar automaticamente.
- [ ] Manter aprovação antes de promover modelo.
- [ ] Registrar versão e origem dos dados.
- [ ] Usar a decisão humana e o resultado da intervenção como rótulos, sem retreino automático em produção.

### Critério de saída

- [ ] Um incidente possui evidência completa, incluindo TAG, inspeção/leitura e termograma quando a origem dispuser de imagem.
- [ ] A OS devolve feedback ao ponto monitorado.
- [ ] Existe comparação antes/depois.
- [ ] O relatório reconstrói toda a linha do tempo.
- [ ] O relatório prova a cadeia `dado -> IA -> decisão humana -> manutenção`.
- [ ] O relatório reconstrói a classificação P5–P100 usada na priorização e não a confunde com score/risco da IA.
- [ ] Dados futuros podem ser rotulados sem acesso direto do Python ao banco operacional.

### Commits sugeridos

```text
feat(reports): add thermal monitoring reports
feat(feedback): link technician diagnosis to thermal incident
feat(learning): prepare controlled production dataset export
```

---

## Etapa 11 — Qualidade, segurança, performance e demonstração

### Objetivo

Estabilizar o MVP para apresentação e uso piloto. Esta etapa não deve introduzir novas grandes features.

### Dependências

- Etapas 0–10 concluídas.

### Tarefas em ordem

#### 11.1. Testes completos

- [ ] Unitários do Next.js.
- [ ] Unitários do FastAPI.
- [ ] Integração com banco de teste.
- [ ] E2E Playwright.
- [ ] Teste de carga.
- [ ] Teste de indisponibilidade do FastAPI.
- [ ] Teste de remoção do artefato de modelo.
- [ ] Teste de tentativa de bypass da IA.
- [ ] Teste de ausência de dados hardcoded/mocks no build demonstrativo.
- [ ] Teste de reconexão do gateway.
- [ ] Teste da escala `P5`–`P100`, distribuição histórica `2/10/7` e separação entre prioridade histórica, risco atual e prioridade final.
- [ ] Teste de upload, autorização, checksum e vínculo do termograma com TAG/leitura/incidente.
- [ ] Teste de fila durável e recuperação de `AI_FAILED`, comprovando que não há worker fantasma após o fim da requisição.

#### 11.2. Segurança

- [ ] Rate limiting.
- [ ] Limite de payload.
- [ ] Proteção de uploads.
- [ ] Auditoria completa.
- [ ] Revisão de permissões.
- [ ] Segredos fortes.
- [ ] CORS restrito.
- [ ] HTTPS no deploy.

#### 11.3. Performance

- [ ] Índices revisados.
- [ ] Queries por período.
- [ ] Agregações horárias/diárias.
- [ ] Política de retenção.
- [ ] Evitar agregação grande em memória no dashboard.
- [ ] Revisar pooling do Prisma/Neon.

#### 11.4. Limpeza de legado

- [ ] Ocultar do fluxo GPMS rotas mecânicas genéricas que desviem a demonstração; remover código somente quando não houver dependência ativa e houver teste de regressão.
- [ ] Não investir em novos campos, telas, CSVs ou calibrações do dataset AI4I/mecânico; ele é legado e não é critério do desafio termográfico.
- [ ] Atualizar README.
- [ ] Atualizar arquitetura.
- [ ] Atualizar checklist.
- [ ] Preservar histórico apenas na tag anterior.
- [ ] Remover `DemoPredictor`, `RULE_ONLY` operacional e variáveis de fallback.
- [ ] Remover a opção manual de OS `PREDICTIVE`.
- [ ] Manter planos preventivos e recursos gerais de PCM somente como apoio à execução da manutenção; não criar novas funcionalidades genéricas sem ligação direta com o desafio.

#### 11.5. Roteiro de demonstração

- [ ] Mostrar mapa dos 55 pontos.
- [ ] Mostrar os 19 inicialmente anormais.
- [ ] Mostrar a distribuição histórica `2 × P20`, `10 × P10`, `7 × P5` e explicar que ela não é o risco atual da IA.
- [ ] Abrir ponto que evolui para 75,6 °C.
- [ ] Exibir referência 40 °C e `deltaT 35,6 °C`.
- [ ] Mostrar explicações.
- [ ] Mostrar `inferenceId`, versão, checksum, confiança e provável modo de falha.
- [ ] Confirmar o defeito como decisão humana.
- [ ] Criar OS depois da confirmação.
- [ ] Registrar ação.
- [ ] Mostrar normalização.
- [ ] Emitir relatório.
- [ ] Abrir a evidência termográfica vinculada ao TAG e ao histórico do ponto.
- [ ] Informar que o modelo usa dados sintéticos.
- [ ] Interromper o FastAPI/remover o modelo e demonstrar que o aplicativo bloqueia a operação em vez de usar regras ou dados prontos.

### Critério de saída

- [ ] Todas as suites obrigatórias passam.
- [ ] Não existem segredos versionados.
- [ ] Não existe fallback demo silencioso.
- [ ] Não existe fallback funcional de nenhuma espécie.
- [ ] Não existem mocks ou resultados hardcoded no ambiente demonstrativo.
- [ ] O teste de remoção da IA comprova que o núcleo do aplicativo para.
- [ ] O cenário completo funciona em instalação limpa.
- [ ] A fila suporta a carga alvo sem depender do cron diário para acompanhar telemetria contínua.
- [ ] A taxonomia P5–P100 e a evidência por termograma passam por E2E e auditoria.
- [ ] O projeto está pronto para apresentação e piloto controlado.

### Commits sugeridos

```text
test: cover end-to-end thermal maintenance workflow
perf: optimize thermal history queries
security: harden telemetry and thermal uploads
chore: remove obsolete mechanical prediction demo
docs: finalize GPMS thermal monitoring documentation
```

---

## Etapa 12 — Piloto na planta e evolução com dados reais

### Objetivo

Validar o sistema no ambiente industrial, começando pelos 19 pontos anormais e sem confundir resultado experimental com segurança certificada.

### Dependências externas

- autorização da empresa;
- responsável técnico;
- definição do hardware;
- procedimentos NR-10;
- conectividade e segurança de rede;
- acesso aos dados de inspeção existentes.
- definição oficial do significado, prazo e regra de escalonamento de `P5`, `P10`, `P20`, `P30`, `P50` e `P100`.

### Tarefas em ordem

#### 12.1. Levantamento

- [ ] Identificar fisicamente os 55 pontos.
- [ ] Priorizar os 19 anormais.
- [ ] Validar o significado da referência de 40 °C.
- [ ] Registrar carga durante inspeções.
- [ ] Avaliar campo de visão e posicionamento.
- [ ] Definir responsável por responder alertas.
- [ ] Importar ou reconciliar o relatório original, seus termogramas, TAGs, recomendações e a distribuição `2 × P20`, `10 × P10`, `7 × P5`.

#### 12.2. Instrumentação controlada

- [ ] Elaborar análise de risco, método de instalação, plano de trabalho, permissões e critérios de parada com responsável técnico e NR-10.
- [ ] Planejar instalação sem interrupção não planejada; qualquer desligamento necessário deve ser autorizado e programado pela planta.
- [ ] Definir rollback físico/lógico e comprovar que falha do sensor/software não interfere nas proteções elétricas existentes.
- [ ] Selecionar sensores/câmeras apropriados para distância, temperatura, isolamento, ambiente e método de montagem; o software não substitui certificação do hardware.
- [ ] Começar por poucos pontos representativos.
- [ ] Comparar sensor contínuo com câmera de referência.
- [ ] Calibrar emissividade e montagem.
- [ ] Medir estabilidade.
- [ ] Expandir gradualmente para os 19.
- [ ] Expandir para 55 somente após validação.

#### 12.3. Baseline real

- [ ] Coletar período normal.
- [ ] Relacionar temperatura e carga.
- [ ] Ajustar thresholds.
- [ ] Medir falsos alertas.
- [ ] Revisar regras por tipo de componente.
- [ ] Medir falso negativo, falso positivo, disponibilidade, atraso de ingestão e concordância com a câmera de referência por tipo de componente.

#### 12.4. Retreinamento futuro

- [ ] Definir rótulo e horizonte com manutenção.
- [ ] Construir dataset real versionado.
- [ ] Comparar modelo novo com regras e modelo sintético.
- [ ] Promover somente se superar critérios aprovados.
- [ ] Manter rollback.
- [ ] Alterar `modelStage` para `PLANT_CALIBRATION` e depois `PLANT_VALIDATED` somente com evidência.
- [ ] Definir com a empresa critérios numéricos mínimos antes da promoção; concluir tarefas sem atingir esses critérios não torna o modelo validado.

### Indicadores do piloto

- disponibilidade dos sensores;
- antecedência dos alertas;
- falsos alertas por ponto/dia;
- alertas confirmados pelos técnicos;
- tempo entre a indicação da IA e a decisão humana;
- tempo até criação/conclusão da OS;
- reincidência;
- concordância com termografia manual;
- falhas detectadas antes de parada.
- percentual de pontos cobertos continuamente, incluindo centrífugas;
- tempo entre detecção, confirmação, criação e conclusão da OS;
- quantidade de pontos que evoluem para prioridade superior entre inspeções;
- interrupções não planejadas causadas pela implantação — meta obrigatória: zero.

### Critério de saída

- [ ] Os pontos-piloto apresentam leitura estável.
- [ ] Thresholds foram revisados com dados reais.
- [ ] O processo de resposta a alertas está definido.
- [ ] Limitações e resultados estão documentados.
- [ ] A implantação não causou interrupção não planejada e não alterou a função das proteções elétricas.
- [ ] A escala P5–P100 foi validada pelo processo de manutenção e aparece de ponta a ponta.
- [ ] Termogramas, TAGs, leituras, recomendações, inferências, decisões e OS são reconstruíveis pela auditoria.
- [ ] Os indicadores de benefício possuem baseline, período, responsável e meta aprovada; não basta a funcionalidade existir.
- [ ] Existe decisão técnica fundamentada sobre expansão.

---

## Ordem recomendada dos próximos commits — a partir da Etapa 10

As Etapas 1–9 estão concluídas. A ordem abaixo é a sequência ativa e evita reimplementar a base já entregue:

1. `feat(thermograms): add private evidence storage and TAG timeline`
2. `feat(reports): add audited inspection prediction decision and maintenance history`
3. `feat(feedback): record post-maintenance outcome without rewriting evidence`
4. `test(e2e): cover telemetry to human-approved predictive work order`
5. `test(soak): validate deployed queue throughput and backlog stability`
6. `feat(pilot): add safe deployment controls and real-data indicators`

MQTT, visão computacional avançada e notificações externas não fazem parte dessa sequência obrigatória. Só deverão entrar se o contrato de telemetria, a validação do piloto ou a empresa demonstrarem necessidade.

---

## Marco demonstrativo alcançado ao final da Etapa 8

O fluxo demonstrativo abaixo já foi alcançado com dados sintéticos persistidos e modelo experimental. Ele valida a integração de software, mas ainda não representa a solução industrial final nem comprova eficácia com dados reais.

```text
55 pontos cadastrados
  -> série sintética simulada e persistida no banco
  -> temperatura 75,6 °C
  -> referência 40 °C
  -> deltaT 35,6 °C
  -> inferência FastAPI com modelo ML carregado
  -> Prediction com proveniência
  -> um incidente crítico
  -> um alerta
  -> confirmação/rejeição humana do defeito
  -> OS preditiva
```

O resultado somente é válido se o frontend estiver lendo o PostgreSQL, o FastAPI estiver executando o artefato treinado e a interrupção da IA impedir novas análises. Nenhuma etapa dessa demonstração poderá ser preenchida por mock, hardcode ou insert de resultado pronto. Para atender integralmente ao desafio ainda são obrigatórias as Etapas 9–12: escala P5–P100, inspeção/termogramas rastreáveis, telemetria contínua com fila durável e piloto seguro com dados reais.

---

# Parte II — Especificação técnica de referência

As seções seguintes preservam os requisitos, contratos e decisões de arquitetura que deverão ser consultados durante cada etapa.

## 1. Objetivo

Adequar a aplicação atual de PCM com IA preditiva para resolver o desafio oficial GPMS 2026 de uma indústria de pet food de Campo Grande (MS), cujo cenário informado é:

- presença de autoclaves, estufas, câmaras frias e mais de 20 centrífugas;
- dependência de inspeções termográficas manuais e pontuais;
- inspeção de quadros elétricos, disjuntores, contatores e relés térmicos;
- 55 pontos inspecionados;
- 19 pontos com anomalia térmica, equivalentes a aproximadamente 34,5% dos pontos;
- classificação original de 2 “Prioridade 3/P20” (intervir em até 30 dias), 10 “Prioridade 4/P10” (intervir em parada programada) e 7 “Prioridade 5/P5” (intensificar monitoramento), dentro da escala empresarial `P5`–`P100`;
- ponto crítico de 75,6 °C contra referência de 40 °C;
- diferença térmica crítica de 35,6 °C;
- padrão predominante relatado de aquecimento em bornes/conexões de disjuntores e contatores, compatível com resistência elevada e possíveis conexões frouxas, oxidadas ou subdimensionadas;
- risco de falha, parada não planejada e incêndio;
- ausência de monitoramento contínuo entre as inspeções.
- necessidade de cruzar termograma, TAG, histórico de recomendações e evolução térmica sem substituir a decisão do profissional.

A solução final deverá monitorar continuamente os pontos térmicos e depender da IA para identificar comportamentos anormais, estimar risco, sugerir o provável modo de falha, priorizar intervenções e explicar cada ocorrência. O humano continuará responsável por reconhecer/confirmar o defeito e decidir a manutenção, pois a IA não executa intervenção física.

### Resultado esperado

Transformar a aplicação de uma demonstração genérica de falhas em equipamentos rotativos em uma plataforma **AI-first de monitoramento termográfico contínuo integrado à execução da manutenção**. Os módulos atuais somente serão preservados quando funcionarem como entrada para a IA, governança ou consequência da análise; não deverão formar um PCM genérico capaz de substituir o núcleo inteligente.

---

## 2. Decisões já definidas

As seguintes decisões orientam toda a implementação:

1. A stack principal será preservada:
   - Next.js 14;
   - React e TypeScript;
   - Prisma;
   - PostgreSQL/Neon;
   - FastAPI;
   - scikit-learn;
   - arquitetura modular existente em `apps/web/src/features`.
2. A autorização histórica para reinicializar o banco foi consumida nas etapas iniciais. A partir da Etapa 9, não executar reset: toda alteração será aditiva, migrável, com backup e rollback.
3. O modelo térmico experimental entregue na Etapa 8 será preservado como baseline; substituição ou promoção exige comparação controlada e rollback.
4. A demonstração utiliza dados sintéticos produzidos por simulação temporal, identificados como sintéticos e persistidos. Dados reais do piloto serão armazenados com origem distinta e nunca misturados silenciosamente.
5. As métricas do modelo anterior não serão apresentadas como validação da solução termográfica.
6. A IA será a base obrigatória da solução. Sem modelo ML carregado, validado e saudável, não existirão diagnóstico, risco, incidente de defeito, alerta preditivo, relatório analítico ou nova OS preditiva.
7. A decisão de manutenção continuará humana. A IA detecta, classifica, explica e recomenda; o profissional confirma ou rejeita o defeito e decide, autoriza e executa a intervenção.
8. A indisponibilidade da IA seguirá comportamento fail-closed. A telemetria poderá ser preservada como `PENDING_AI` para evitar perda, mas isso não conta como funcionamento analítico e não autoriza decisão operacional.
9. Dados demonstrativos serão sintéticos, gerados por simulação temporal e persistidos no banco real de desenvolvimento. Não haverá respostas mockadas, dashboards hardcoded ou resultados analíticos inseridos previamente.
10. A primeira implantação deverá priorizar os 19 pontos já anormais, mantendo cadastrados os 55 pontos para expansão.
11. O sistema deverá ser independente de fabricante de sensor ou câmera.
12. A instalação física em painéis elétricos deverá ser validada e executada por profissionais habilitados, seguindo NR-10, procedimentos internos e avaliação de engenharia da planta.
13. A prioridade empresarial `P5`–`P100` será preservada como dimensão própria e auditável. Ela não poderá ser substituída pelo `RiskLevel` do modelo nem por `WorkOrderPriority` genérica.
14. A solução final deverá ser implantável sem interrupção não planejada e sem alterar/substituir as proteções elétricas existentes; qualquer parada necessária será decisão programada e autorizada pela planta.
15. Termogramas serão evidência vinculada ao TAG, à inspeção e à leitura. Visão computacional avançada não é obrigatória, mas armazenar, proteger e reconstruir a evidência é.

---

## 3. Diagnóstico inicial do repositório — registro histórico

> Esta seção descreve a linha de base encontrada em 02/09/2026 e explica por que as Etapas 1–8 foram necessárias. Ela não é uma lista de trabalho atual. Para novas implementações, usar as Etapas 9–12 e `docs/checklist-pendencias.md`; não recriar correções já concluídas.

### 3.1. Componentes que devem ser preservados

| Componente atual             | Local principal                               | Decisão                                                    |
| ---------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Autenticação e perfis        | `features/auth`, `features/users`, `lib/auth` | Preservar                                                  |
| Permissões por papel         | `lib/permissions`                             | Preservar e ampliar                                        |
| Setores e equipamentos       | `features/sectors`, `features/equipments`     | Preservar como nível superior da hierarquia                |
| Ordens de serviço            | `features/work-orders`                        | Preservar como etapa posterior à confirmação humana; bloquear `PREDICTIVE` manual |
| Planos preventivos           | `features/maintenance-plans`                  | Manter apenas como apoio interno ou ocultar do fluxo GPMS; não podem sustentar o produto sem IA |
| Alertas                      | `features/alerts`                             | Preservar, mas alterar deduplicação e ciclo de vida        |
| Histórico de falhas reais    | `features/failure-events`                     | Preservar e especializar causas elétricas/térmicas         |
| Relatórios em PDF            | `features/reports`                            | Preservar e criar relatórios termográficos                 |
| Serviço FastAPI independente | `services/predictive-ai`                      | Preservar a fronteira e substituir o domínio do modelo     |
| Auditoria                    | `AuditLog`                                    | Preservar e ampliar cobertura                              |
| Dashboard                    | `features/dashboard`                          | Tornar dependente de `Prediction` válida e bloquear sem IA  |

### 3.2. Limitações que impedem o atendimento do desafio

#### Modelo de dados genérico

O modelo `SensorReading`, em `apps/web/prisma/schema.prisma`, está relacionado diretamente a `Equipment` e contém temperatura, vibração, pressão, RPM, corrente, torque, horas de operação e variáveis do AI4I. Ele não representa:

- painel elétrico;
- componente interno;
- ponto termográfico;
- sensor instalado;
- temperatura ambiente e de referência;
- diferença térmica;
- emissividade;
- termograma;
- qualidade da medição;
- estado de comunicação do dispositivo.

#### Ausência de ingestão contínua

As medições são registradas por formulário, CSV ou simulador. Não existe uma rota própria para dispositivos, autenticação por dispositivo, processamento em lote, protocolo MQTT ou controle de conectividade.

#### Predição por leitura isolada

`sensor-reading.service.ts` registra a medição e chama imediatamente `predictionService.runPredictionForReading()`. O FastAPI recebe somente a leitura atual. Não existe janela temporal, inclinação da temperatura, persistência do desvio ou comparação com baseline do ponto.

#### Modelo treinado para outro problema

O pipeline atual usa um dataset sintético inspirado no AI4I e variáveis de máquinas rotativas. Isso é útil como prova da arquitetura, mas inadequado para prever anomalias em disjuntores, contatores, relés e conexões elétricas.

#### Alertas duplicados

Cada nova predição moderada, alta ou crítica cria um novo `Alert`. Em monitoramento por minuto, uma anomalia contínua poderia gerar centenas de alertas para o mesmo componente.

#### Artefato do modelo não é distribuído

O `.gitignore` ignora `services/predictive-ai/models/*.joblib`. O repositório contém metadados do treinamento, mas não o binário do modelo. Uma instalação nova utiliza `DemoPredictor` até que um modelo seja treinado ou baixado de um armazenamento externo.

#### A IA pode ser contornada

O comportamento atual mantém o PCM funcional sem FastAPI, usa `DemoPredictor` quando o artefato não existe e permite criar uma OS `PREDICTIVE` com `sourcePredictionId` opcional. Isso contradiz o critério de dependência de IA. O produto adequado deverá remover o predictor de demonstração, bloquear o fluxo autenticado quando a readiness da IA falhar e exigir proveniência de modelo e confirmação humana para toda OS preditiva.

#### Seed incompatível com o desafio

`apps/web/prisma/seed.ts` cria motores, bombas, compressor, redutor, ventilador e caldeira, além de leituras baseadas em vibração, RPM e torque. Esse cenário deverá ser substituído por uma planta demonstrativa termográfica.

---

## 4. Escopo funcional da solução adequada

### 4.1. Escopo obrigatório do software

- cadastrar a hierarquia da planta, equipamentos, painéis, componentes e pontos;
- representar os 55 pontos termográficos;
- identificar os 19 pontos originalmente anormais;
- registrar a inspeção original com exatamente 2 P3/P20, 10 P4/P10 e 7 P5/P5, mantendo separados o rótulo da fonte e o código empresarial e oferecendo suporte a `P5`, `P10`, `P20`, `P30`, `P50` e `P100`;
- separar prioridade histórica da inspeção, risco atual da IA, prioridade recomendada pela política empresarial e prioridade final autorizada pelo humano;
- receber leituras térmicas manuais, por CSV, simulador e API de telemetria;
- registrar inspeções e termogramas vinculados ao ponto/TAG, leitura e recomendação histórica;
- gerar dados sintéticos por simulação temporal e aplicá-los ao banco real de desenvolvimento, sem mocks;
- calcular temperatura relativa, `deltaT`, tendência e permanência acima do limite como features da IA;
- executar obrigatoriamente modelo termográfico treinado para analisar cada leitura/janela elegível;
- consolidar predições consecutivas em uma única ocorrência;
- exibir o estado atual de cada ponto;
- gerar alertas explicáveis com proveniência completa da IA;
- representar resistência elevada/conexão frouxa como modo de falha provável e manter oxidação ou subdimensionamento como hipóteses até confirmação técnica; temperatura isolada não fecha causa-raiz;
- permitir confirmação, rejeição ou solicitação de nova leitura pelo humano;
- permitir conversão em OS somente após confirmação humana;
- impedir OS preditiva manual ou sem `sourcePredictionId` válido;
- acompanhar a normalização após manutenção;
- armazenar confirmação do técnico e causa encontrada;
- manter histórico e trilha de auditoria;
- operar a telemetria por fila durável com vazão suficiente para 55 pontos/minuto, sem usar o cron diário como substituto de monitoramento contínuo;
- executar um modelo treinado com dados sintéticos termográficos;
- sinalizar claramente que o modelo é experimental, foi treinado com dados sintéticos e ainda não foi validado na planta;
- operar em fail-closed quando o modelo estiver ausente, corrompido ou indisponível;
- provar, por teste automatizado, que a remoção da IA interrompe o núcleo operacional.
- permitir implantação progressiva sem interrupção não planejada, condicionada a responsável técnico, NR-10 e procedimentos da planta.

### 4.2. Escopo obrigatório para o piloto e a validação industrial

- ingestão automática de sensores ou câmeras;
- cadastro e autenticação individual de dispositivos;
- envio de dados em lote quando a rede retornar;
- detecção de sensor offline;
- validação do termograma e das medições contínuas contra câmera de referência;
- notificações externas por canal configurável somente se a empresa pedir; alerta interno auditável é o requisito mínimo;
- dashboard de atualização quase em tempo real;
- indicadores de tempo de detecção e falsos alertas;
- piloto inicial nos 19 pontos anormais.
- metas aprovadas para disponibilidade, antecedência, falsos alertas, tempo até decisão/OS e zero interrupção não planejada causada pela implantação.

### 4.3. Fora do escopo inicial

- manutenção autônoma sem aprovação humana;
- desligamento automático de circuitos pelo software;
- substituição de sistemas de proteção elétrica;
- certificação do algoritmo como dispositivo de segurança;
- promessa de previsão exata de incêndio;
- treinamento definitivo usando somente dados sintéticos;
- visão computacional avançada para qualquer marca de termograma já no primeiro MVP;
- instrumentação imediata dos 55 pontos sem piloto técnico.
- MQTT, ESP32 ou qualquer fabricante/protocolo específico como dependência obrigatória;
- retreinamento ou promoção automática do modelo sem aprovação e comparação controlada;
- novas funcionalidades do PCM mecânico/AI4I que não sustentem diretamente o fluxo termográfico do desafio.

---

## 5. Arquitetura-alvo

```text
Sensor/câmera térmica
        |
        v
Gateway/edge industrial
        |
        | HTTPS ou MQTT
        v
API de ingestão do Next.js
        |
        +--> PostgreSQL: leitura bruta e histórico
        |
        +--> agregação de janela temporal
                  |
                  v
          FastAPI: modelo de IA obrigatório
                  |
                  v
        Prediction com proveniência
                  |
                  +--> dashboard
                  +--> alerta consolidado
                  +--> confirmação/rejeição humana
                              |
                              +--> ordem de serviço autorizada
```

### 5.1. Responsabilidades

#### Gateway/edge

- coletar leituras do sensor ou câmera;
- acrescentar `deviceId`, horário, sequência e qualidade;
- manter buffer local se a rede cair;
- reenviar lotes sem duplicar medições;
- não decidir sozinho se uma OS deve ser criada;
- opcionalmente aplicar limite local de emergência definido pela engenharia.

#### Next.js

- autenticar dispositivos e usuários;
- validar payloads;
- persistir telemetria;
- calcular/agregar contexto histórico necessário;
- chamar o FastAPI;
- rejeitar respostas sem modelo/proveniência;
- bloquear o fluxo operacional quando a IA não estiver ready;
- controlar alertas, ocorrências, revisão humana, OS, interface e auditoria.

#### FastAPI

- não acessar diretamente o banco operacional;
- receber leitura atual e resumo da janela temporal;
- exigir artefato ML e metadados válidos para ficar ready;
- aplicar validações e controles de engenharia sem permitir inferência somente por regras;
- executar detecção de anomalia/modelo supervisionado;
- devolver risco, confiança, provável modo de falha, fatores, ações sugeridas e proveniência;
- informar se o modelo é sintético, experimental ou validado.

#### PostgreSQL

- armazenar cadastro operacional;
- manter leituras brutas por período definido;
- manter agregações históricas;
- registrar predições, ocorrências, alertas e ações humanas;
- impedir que os rótulos sintéticos usados para validação sejam consultados pelo runtime;
- permitir auditoria e construção futura de dataset real.

---

## 6. Novo domínio de dados

### 6.1. Hierarquia recomendada

```text
Sector
└── Equipment
    └── ElectricalPanel
        └── MonitoredComponent
            └── ThermalPoint
                ├── SensorDevice
                ├── ThermalReading
                ├── Thermogram
                ├── Prediction
                └── ThermalIncident
```

`Equipment` continuará representando o ativo produtivo, como autoclave, estufa, câmara fria ou centrífuga. O painel poderá estar relacionado a um equipamento específico ou a um setor quando alimentar vários ativos.

### 6.2. Novos enums sugeridos

> A Etapa 1 já criou a primeira versão destes enums. A estrutura abaixo representa o estado-alvo após as migrations de evolução. Se `RULE_ONLY` já existir no banco, ele deverá ser tratado como legado, nunca atribuído por código novo e removido quando não houver registros dependentes.

```prisma
enum PanelType {
  MCC
  DISTRIBUTION
  CONTROL
  PROTECTION
  OTHER
}

enum ElectricalComponentType {
  CIRCUIT_BREAKER
  CONTACTOR
  THERMAL_RELAY
  TERMINAL
  BUSBAR
  FUSE
  CABLE_CONNECTION
  POWER_SUPPLY
  DRIVE
  OTHER
}

enum MonitoringMode {
  MANUAL
  CSV
  SIMULATOR
  POINT_SENSOR
  THERMAL_ARRAY
  THERMAL_CAMERA
}

enum DeviceStatus {
  PROVISIONING
  ONLINE
  OFFLINE
  DEGRADED
  MAINTENANCE
  DISABLED
}

enum ModelStage {
  SYNTHETIC_EXPERIMENTAL
  PLANT_CALIBRATION
  PLANT_VALIDATED
}

enum AnalysisStatus {
  PENDING_AI
  ANALYZED
  AI_FAILED
  SUPERSEDED
}

enum IncidentStatus {
  PENDING_HUMAN_REVIEW
  HUMAN_CONFIRMED
  HUMAN_REJECTED
  INCONCLUSIVE
  NEW_READING_REQUIRED
  WORK_ORDER_CREATED
  MONITORING_AFTER_ACTION
  NORMALIZED
}

enum HumanReviewDecision {
  CONFIRMED
  REJECTED
  INCONCLUSIVE
  NEW_READING_REQUIRED
}

enum ThermalCause {
  LOOSE_CONNECTION
  CONTACT_RESISTANCE
  OVERLOAD
  PHASE_IMBALANCE
  DEGRADED_CONTACT
  INSUFFICIENT_VENTILATION
  THERMAL_RELAY_DEGRADATION
  PROCESS_CONDITION
  SENSOR_ERROR
  NOT_CONFIRMED
  OTHER
}

enum CompanyThermalPriority {
  P5
  P10
  P20
  P30
  P50
  P100
}
```

`CompanyThermalPriority` representa a classificação usada pela empresa e não é sinônimo de severidade da IA. `P5`, `P10` e `P20` possuem os significados informados no desafio; `P30`, `P50` e `P100` devem existir para compatibilidade, mas seus prazos e critérios somente poderão ser configurados depois de validação formal pela empresa.

Os significados conhecidos devem ser preservados literalmente: `P20` = intervir em até 30 dias; `P10` = intervir em parada programada; `P5` = intensificar monitoramento. O rótulo ordinal da fonte (“Prioridade 3”, “Prioridade 4” ou “Prioridade 5”) é evidência separada do código P e não deve ser recalculado pelo software.

### 6.3. Novas entidades sugeridas

O schema abaixo é uma referência de implementação. Os nomes finais devem seguir a convenção adotada no Prisma atual.

```prisma
model ThermalInspection {
  id              String   @id @default(uuid())
  inspectedAt     DateTime
  sourceReference String?
  technicianName  String?
  notes           String?
  createdAt       DateTime @default(now())

  findings ThermalInspectionFinding[]

  @@index([inspectedAt])
  @@map("thermal_inspections")
}

model ThermalInspectionFinding {
  id                   String                 @id @default(uuid())
  inspectionId         String
  thermalPointId       String
  thermalReadingId     String?
  sourcePriorityLabel  String?
  companyPriority      CompanyThermalPriority
  recommendation       String?
  observedCause        ThermalCause?
  historicalBaseline   Boolean                @default(false)
  createdAt            DateTime               @default(now())

  inspection    ThermalInspection @relation(fields: [inspectionId], references: [id], onDelete: Restrict)
  thermalPoint  ThermalPoint      @relation(fields: [thermalPointId], references: [id], onDelete: Restrict)
  thermalReading ThermalReading?  @relation(fields: [thermalReadingId], references: [id], onDelete: SetNull)

  @@unique([inspectionId, thermalPointId])
  @@index([thermalPointId, createdAt])
  @@index([companyPriority])
  @@map("thermal_inspection_findings")
}

model ElectricalPanel {
  id          String    @id @default(uuid())
  tag         String    @unique
  name        String
  description String?
  location    String?
  panelType   PanelType
  sectorId    String
  equipmentId String?
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  sector      Sector     @relation(fields: [sectorId], references: [id])
  equipment   Equipment? @relation(fields: [equipmentId], references: [id])
  components  MonitoredComponent[]

  @@index([sectorId])
  @@index([equipmentId])
  @@map("electrical_panels")
}

model MonitoredComponent {
  id            String                  @id @default(uuid())
  tag           String                  @unique
  name          String
  componentType ElectricalComponentType
  phase         String?
  ratedCurrent  Float?
  manufacturer  String?
  model         String?
  panelId       String
  active        Boolean                 @default(true)
  createdAt     DateTime                @default(now())
  updatedAt     DateTime                @updatedAt

  panel         ElectricalPanel @relation(fields: [panelId], references: [id])
  thermalPoints ThermalPoint[]

  @@index([panelId])
  @@map("monitored_components")
}

model ThermalPoint {
  id                   String         @id @default(uuid())
  code                 String         @unique
  name                 String
  componentId          String
  monitoringMode       MonitoringMode
  emissivity           Float?
  referenceDescription String?
  absoluteLimitC       Float?
  deltaTAttentionC     Float?
  deltaTHighC          Float?
  deltaTCriticalC      Float?
  sampleIntervalSec    Int            @default(60)
  initiallyAnomalous   Boolean        @default(false)
  active               Boolean        @default(true)
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt

  component  MonitoredComponent @relation(fields: [componentId], references: [id])
  devices    SensorDevice[]
  readings   ThermalReading[]
  incidents  ThermalIncident[]
  predictions Prediction[]
  inspectionFindings ThermalInspectionFinding[]

  @@index([componentId])
  @@map("thermal_points")
}

model SensorDevice {
  id               String       @id @default(uuid())
  serialNumber     String       @unique
  name             String
  manufacturer     String?
  model            String?
  firmwareVersion  String?
  status           DeviceStatus @default(PROVISIONING)
  thermalPointId   String
  lastSeenAt       DateTime?
  lastSequence     BigInt?
  calibrationDate  DateTime?
  installedAt      DateTime?
  disabledAt       DateTime?
  apiKeyHash       String
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  thermalPoint ThermalPoint     @relation(fields: [thermalPointId], references: [id])
  readings     ThermalReading[]

  @@index([thermalPointId])
  @@index([status, lastSeenAt])
  @@map("sensor_devices")
}

model ThermalReading {
  id                   String   @id @default(uuid())
  thermalPointId       String
  sensorDeviceId       String?
  measuredAt           DateTime
  receivedAt           DateTime @default(now())
  sequence             BigInt?
  temperatureMaxC      Float
  temperatureAverageC  Float?
  ambientTemperatureC  Float?
  referenceTemperatureC Float?
  deltaTC              Float?
  currentA             Float?
  loadPercent          Float?
  emissivity           Float?
  signalQuality        Float?
  source               MonitoringMode
  rawPayload           Json?

  thermalPoint ThermalPoint  @relation(fields: [thermalPointId], references: [id])
  sensorDevice SensorDevice? @relation(fields: [sensorDeviceId], references: [id])
  thermogram   Thermogram?
  predictions  Prediction[]
  inspectionFindings ThermalInspectionFinding[]

  @@unique([sensorDeviceId, sequence])
  @@index([thermalPointId, measuredAt])
  @@index([measuredAt])
  @@map("thermal_readings")
}

model Thermogram {
  id               String   @id @default(uuid())
  thermalReadingId String   @unique
  storageKey       String
  mimeType         String
  width            Int?
  height           Int?
  minTemperatureC  Float?
  maxTemperatureC  Float?
  roi              Json?
  capturedAt       DateTime
  createdAt        DateTime @default(now())

  thermalReading ThermalReading @relation(fields: [thermalReadingId], references: [id], onDelete: Cascade)

  @@map("thermograms")
}

model ThermalIncident {
  id                 String         @id @default(uuid())
  thermalPointId     String
  triggerPredictionId String
  status             IncidentStatus @default(PENDING_HUMAN_REVIEW)
  severity           AlertSeverity
  openedAt           DateTime       @default(now())
  reviewedAt         DateTime?
  normalizedAt       DateTime?
  peakTemperatureC   Float
  peakDeltaTC        Float?
  lastRiskScore      Float
  cause              ThermalCause   @default(NOT_CONFIRMED)
  diagnosis          String?
  recommendation     String?
  humanDecision      HumanReviewDecision?
  humanJustification String?
  workOrderId        String?
  reviewedById       String?
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt

  thermalPoint      ThermalPoint @relation(fields: [thermalPointId], references: [id])
  triggerPrediction Prediction   @relation(fields: [triggerPredictionId], references: [id])
  workOrder         WorkOrder?   @relation(fields: [workOrderId], references: [id])
  reviewedBy        User?        @relation(fields: [reviewedById], references: [id])

  @@index([thermalPointId, status])
  @@index([severity, status])
  @@map("thermal_incidents")
}
```

### 6.4. Evolução de `Prediction`

O modelo atual está ligado somente a `equipmentId`. Recomenda-se adicionar vínculo opcional com `ThermalPoint` e `ThermalReading`, mantendo compatibilidade durante a migração.

Campos recomendados:

```prisma
thermalPointId      String?
thermalReadingId    String?
inferenceId         String   @unique
riskScore           Float
riskLevel           RiskLevel
confidence          Float
modelStage          ModelStage
modelVersion        String
modelChecksum       String
ruleScore           Float?
modelScore          Float
predictedFailureMode ThermalCause?
failureModeConfidence Float?
trendCPerHour       Float?
timeAboveLimitMin   Float?
explanations        Json
recommendedAction   String?
predictionHorizonH  Int?
```

`failureProbability` poderá permanecer temporariamente para compatibilidade, mas a interface deverá priorizar `riskScore`. Dados sintéticos não justificam apresentar probabilidade industrial calibrada.

Uma `Prediction` operacional deverá possuir `modelScore`, `modelVersion`, `modelChecksum`, `inferenceId` e `modelStage` aceito. `ruleScore` é somente evidência complementar e não autoriza um registro quando a inferência ML estiver ausente.

### 6.5. Evolução de `Alert`

Adicionar relação com `ThermalIncident`. Um alerta deverá representar uma ocorrência térmica consolidada, e não cada leitura individual.

Campos sugeridos:

- `thermalIncidentId`;
- `firstTriggeredAt`;
- `lastTriggeredAt`;
- `triggerCount`;
- `peakTemperatureC`;
- `peakDeltaTC`;
- `escalatedAt`;
- `notificationStatus`.

### 6.6. Invariantes para `WorkOrder`

- uma OS do tipo `PREDICTIVE` exige `sourcePredictionId` não nulo;
- a `Prediction` deve possuir modelo/proveniência válidos e pertencer ao mesmo ponto/equipamento;
- o incidente relacionado deve estar em `HUMAN_CONFIRMED`;
- somente o fluxo de confirmação do incidente pode criar a OS preditiva;
- o formulário genérico não deve oferecer `PREDICTIVE` como opção manual;
- as validações devem ocorrer no service e, quando possível, ser reforçadas por constraint/transação no banco.
- uma OS térmica deve preservar `companyPriority` e `priorityPolicyVersion` usados na decisão; `WorkOrderPriority` poderá continuar para ordenação interna, mas não substituirá a classificação P5–P100.

### 6.7. Invariantes da inspeção e da prioridade empresarial

- a inspeção original é evidência histórica imutável, não um sinal de risco atual;
- a carga demonstrativa deve conter 19 `ThermalInspectionFinding`: 2 com rótulo original “Prioridade 3” e P20, 10 “Prioridade 4” e P10, e 7 “Prioridade 5” e P5;
- `TP-039` pertence ao grupo P20 e preserva 75,6 °C, referência de 40 °C e `deltaT` de 35,6 °C;
- toda inspeção/finding referencia um `ThermalPoint` e, quando disponível, a leitura e o termograma correspondentes;
- a prioridade recomendada atual só pode nascer depois de uma Prediction válida e de uma política empresarial versionada;
- ajuste humano da prioridade exige autor, data e justificativa;
- incidentes, OS e relatórios guardam snapshot da prioridade e da versão da política, evitando que uma alteração futura reescreva decisões antigas.

---

## 7. Regras de negócio termográficas e governança da IA

### 7.1. Cálculos básicos

Quando houver temperatura de referência:

```text
deltaT = temperatureMaxC - referenceTemperatureC
```

Quando não houver referência comparável, utilizar temperatura ambiente:

```text
riseAboveAmbient = temperatureMaxC - ambientTemperatureC
```

A aplicação deverá armazenar tanto as temperaturas originais quanto os valores derivados. Valores derivados devem ser recalculáveis e rastreáveis. Esses cálculos são features para a IA e não constituem, isoladamente, diagnóstico ou severidade operacional.

### 7.2. Variáveis temporais

Para cada ponto, calcular pelo menos:

- média móvel de 5, 15 e 60 minutos;
- máximo das últimas 1, 6 e 24 horas;
- inclinação em °C/h;
- variação contra o mesmo horário do ciclo anterior;
- tempo contínuo acima do limite;
- número de leituras consecutivas anormais;
- quantidade de oscilações do estado no período;
- tempo desde a última leitura válida.

### 7.3. Severidade

As faixas não devem ser universais e imutáveis. Devem existir configurações globais com possibilidade de override por tipo de componente e por ponto.

Ordem de precedência:

1. configuração específica de `ThermalPoint`;
2. configuração de `ElectricalComponentType`;
3. configuração global;
4. configuração padrão versionada e documentada.

Thresholds produzem contexto e flags de segurança. Eles não podem abrir sozinhos um incidente de defeito, gerar uma `Prediction` ou substituir o modelo.

#### 7.3.1. Compatibilidade com a prioridade P5–P100

O sistema deverá apresentar quatro dimensões sem misturá-las:

1. `originalCompanyPriority`: classificação imutável da inspeção de origem;
2. `riskLevel`/`riskScore`: estado atual inferido pela IA;
3. `recommendedCompanyPriority`: recomendação produzida por política versionada depois de uma inferência válida;
4. `finalCompanyPriority`: prioridade confirmada/ajustada pelo responsável humano e copiada para a OS.

A aplicação não poderá codificar uma equivalência universal como `CRITICAL = P100`. Os significados de P30/P50/P100 e qualquer conversão deverão vir de configuração aprovada pela empresa. Enquanto essa política não existir, o sistema exibe risco e prioridade histórica, mas não inventa prioridade atual.

### 7.4. Elegibilidade, inferência e persistência

Uma leitura isolada poderá aparecer como dado bruto, mas seu estado operacional dependerá de uma inferência válida. O orquestrador deverá construir a janela temporal e enviá-la ao modelo.

Política inicial sugerida depois da inferência:

- `CRITICAL` retornado pela IA: abertura imediata; um piso de engenharia pode impedir rebaixamento, mas somente quando também existir `modelScore` válido;
- `HIGH` retornado pela IA: abrir após duas predições consecutivas ou persistência por 2 minutos;
- `MODERATE` retornado pela IA: abrir após três predições consecutivas ou persistência por 5 minutos;
- `LOW` retornado pela IA: registrar no histórico sem abrir incidente;
- sem resposta válida da IA: manter `PENDING_AI`/`AI_FAILED`, sem presumir normalidade.

Os valores devem ser configuráveis conforme o intervalo de coleta. A persistência considera sequência de predições, não somente comparação bruta com threshold.

### 7.5. Deduplicação

Depois de uma `Prediction` elegível da IA e antes de criar um incidente, procurar um incidente não finalizado para o mesmo `thermalPointId`.

- Se existir, atualizar pico, última leitura, contagem e severidade.
- Se a severidade aumentar, registrar escalonamento.
- Se diminuir, não encerrar imediatamente.
- Abrir novo incidente somente depois que o anterior for normalizado ou descartado.

### 7.6. Histerese e normalização

O incidente só deve ser considerado normalizado quando:

- o valor permanecer abaixo do limite de recuperação;
- por uma janela mínima configurável;
- sem nova escalada;
- e, para ocorrências críticas, houver validação humana.

A janela de recuperação deverá conter novas inferências válidas. Queda bruta de temperatura sem IA disponível não encerra o incidente.

Exemplo: abrir acima de 80 pontos de risco e iniciar recuperação abaixo de 65. Isso evita alternância rápida entre estados.

### 7.7. Sensor offline

Se `lastSeenAt` ultrapassar três vezes o intervalo esperado de amostragem:

- marcar o dispositivo como `DEGRADED`;
- exibir atraso no dashboard;
- abrir alerta técnico de comunicação se o atraso persistir;
- não interpretar ausência de leitura como normalidade térmica.

### 7.8. Conversão em OS

Somente um usuário autorizado poderá converter o incidente em OS depois de escolher `CONFIRMED`. `ACKNOWLEDGED` ou simples visualização do alerta não bastam. Ao converter, copiar para a OS:

- painel e componente;
- ponto termográfico;
- temperatura máxima;
- temperatura de referência;
- `deltaT`;
- tendência;
- data de início;
- fatores explicativos;
- ação sugerida;
- link para termograma e histórico;
- checklist de inspeção elétrica;
- identificação do modelo que originou a inferência e dos controles de engenharia aplicados;
- `inferenceId`, versão e checksum do modelo;
- decisão, autor e justificativa da revisão humana.

### 7.9. Fechamento da OS e feedback

Ao concluir uma OS preditiva ou corretiva relacionada:

- exigir causa encontrada;
- registrar se a anomalia foi confirmada;
- registrar componente substituído/reapertado/reparado;
- registrar temperatura após intervenção;
- relacionar o resultado a `FailureEvent` quando houver falha real;
- iniciar período de monitoramento pós-ação;
- usar esse resultado como rótulo futuro do dataset real.

### 7.10. Autoridade humana

O humano não substitui o algoritmo na análise inicial. Ele recebe a evidência produzida pela IA e escolhe:

- `CONFIRMED`: reconhece o defeito e pode autorizar a OS;
- `REJECTED`: rejeita a hipótese, com justificativa obrigatória;
- `INCONCLUSIVE`: mantém o caso sem OS e solicita avaliação adicional;
- `NEW_READING_REQUIRED`: pede nova medição/termograma.

A IA não executa manutenção, não inicia intervenção física e não encerra sozinha uma OS.

### 7.11. Falha fechada

Se o modelo, FastAPI, metadados ou checksum estiverem indisponíveis/inválidos:

- preservar a leitura como pendente quando tecnicamente possível;
- não gerar score, severidade, causa, incidente de defeito, alerta preditivo ou OS;
- bloquear os módulos operacionais dependentes da IA;
- informar claramente `AI_CORE_UNAVAILABLE`;
- reprocessar a fila somente quando o mesmo contrato de IA voltar a ficar ready.

---

## 8. API de telemetria

### 8.1. Nova rota

Criar uma Route Handler separada das Server Actions de usuário:

```text
POST /api/v1/telemetry/thermal-readings
```

Essa rota não deve usar a sessão Auth.js de usuário. Ela deverá autenticar o dispositivo por uma credencial própria.

### 8.2. Exemplo de payload em lote

```json
{
  "deviceId": "dev-panel-01",
  "sentAt": "2026-09-02T16:30:00Z",
  "readings": [
    {
      "sequence": 15021,
      "thermalPointCode": "TP-001",
      "measuredAt": "2026-09-02T16:29:00Z",
      "temperatureMaxC": 75.6,
      "temperatureAverageC": 61.2,
      "ambientTemperatureC": 29.1,
      "referenceTemperatureC": 40.0,
      "currentA": 31.4,
      "loadPercent": 78.5,
      "emissivity": 0.95,
      "signalQuality": 0.98
    }
  ]
}
```

### 8.3. Resposta esperada

```json
{
  "accepted": 1,
  "duplicated": 0,
  "rejected": 0,
  "results": [
    {
      "sequence": 15021,
      "readingId": "uuid",
      "status": "ACCEPTED"
    }
  ]
}
```

### 8.4. Requisitos da ingestão

- limite máximo de itens por lote;
- limite de tamanho do payload;
- validação Zod no servidor;
- rejeição de datas excessivamente futuras;
- tolerância configurada para leituras atrasadas;
- idempotência por `sensorDeviceId + sequence`;
- autenticação com chave armazenada apenas como hash;
- possibilidade de rotação e revogação da chave;
- rate limiting por dispositivo;
- registro de falhas de autenticação;
- processamento assíncrono ou em lote quando o volume crescer;
- resposta parcial por item, sem perder o lote inteiro por uma linha inválida.
- referência opcional a termograma previamente enviado por canal autenticado; arquivos não devem trafegar como base64 dentro do lote de alta frequência.
- persistência em fila durável antes da resposta de sucesso; memória do processo serverless não é garantia de entrega.

### 8.5. Frequência e volume

Com 55 pontos enviando uma leitura por minuto:

```text
55 × 60 × 24 = 79.200 leituras/dia
aproximadamente 2,38 milhões de leituras em 30 dias
```

O volume é administrável em PostgreSQL para um piloto, mas exige:

- índices compostos;
- consultas limitadas por período;
- agregações horárias/diárias;
- política de retenção;
- limpeza ou arquivamento de leituras brutas;
- evitar renderizar milhares de pontos diretamente no frontend;
- evitar uma chamada FastAPI por leitura em importações ou backfills.

---

## 9. Serviço FastAPI e núcleo obrigatório de IA

### 9.1. Estrutura recomendada

```text
services/predictive-ai/app/
├── api/routes/
│   ├── health.py
│   └── thermal_predictions.py
├── guards/
│   ├── input_quality.py
│   └── thermal_safety_floor.py
├── features/
│   └── thermal_features.py
├── ml/
│   ├── model_loader.py
│   ├── thermal_predictor.py
│   ├── anomaly_detector.py
│   └── ensemble.py
└── schemas/
    ├── thermal_prediction_input.py
    └── thermal_prediction_output.py
```

### 9.2. Novo contrato de entrada

O FastAPI deverá receber:

- identificadores do tipo de componente, sem depender de consultar o banco;
- leitura atual;
- limites aplicáveis;
- resumo da janela histórica;
- baseline do ponto;
- estágio do modelo;
- informações de qualidade.

O endpoint deverá recusar a inferência quando não houver modelo ML carregado. Nenhum parâmetro de entrada poderá selecionar predictor de demonstração ou modo baseado somente em regras.

### 9.3. Exemplo de entrada

```json
{
  "inferenceRequestId": "uuid-idempotente",
  "thermalPointId": "uuid",
  "componentType": "CONTACTOR",
  "current": {
    "temperatureMaxC": 75.6,
    "ambientTemperatureC": 29.1,
    "referenceTemperatureC": 40.0,
    "deltaTC": 35.6,
    "currentA": 31.4,
    "loadPercent": 78.5,
    "signalQuality": 0.98
  },
  "window": {
    "mean5mC": 72.9,
    "mean15mC": 68.4,
    "max1hC": 75.6,
    "trendCPerHour": 8.2,
    "minutesAboveLimit": 12,
    "consecutiveAnomalies": 12
  },
  "baseline": {
    "expectedTemperatureC": 43.0,
    "standardDeviationC": 2.1,
    "sampleCount": 8400
  },
  "thresholds": {
    "attentionDeltaTC": 10,
    "highDeltaTC": 20,
    "criticalDeltaTC": 30
  }
}
```

### 9.4. Exemplo de saída

```json
{
  "inferenceId": "uuid",
  "riskScore": 96.4,
  "riskLevel": "CRITICAL",
  "confidence": 0.91,
  "ruleScore": 100,
  "modelScore": 92.8,
  "modelVersion": "thermal-synthetic-2026.09.01",
  "modelChecksum": "sha256:...",
  "modelStage": "SYNTHETIC_EXPERIMENTAL",
  "isSyntheticModel": true,
  "predictedFailureMode": "CONTACT_RESISTANCE",
  "failureModeConfidence": 0.84,
  "explanations": [
    "Diferença de 35,6 °C acima da referência",
    "Temperatura aumentou 8,2 °C na última hora",
    "Limite permaneceu excedido por 12 minutos"
  ],
  "recommendedAction": "Solicitar inspeção elétrica prioritária do contator e verificar aperto, corrente e condição dos contatos."
}
```

### 9.5. Combinação obrigatória entre ML e controles de engenharia

A primeira versão poderá usar um ensemble transparente, desde que o modelo seja sempre obrigatório:

```text
se modelo indisponível:
  falhar sem produzir Prediction

modelScore = inferência ML válida
safetyFloor = controle de engenharia calculado
risco final = máximo(modelScore calibrado, safetyFloor)
```

O piso de segurança impede que uma condição crítica seja rebaixada, mas não é um predictor independente. Sem `modelScore`, o cálculo final não existe e nenhum artefato operacional é criado.

### 9.6. Política fail-closed

- remover o `DemoPredictor` do runtime;
- não criar `ThermalRulePredictor` como alternativa funcional;
- exigir artefato, metadados, checksum e estágio de modelo permitidos na inicialização;
- retornar readiness não saudável e `503` quando o modelo não puder inferir;
- manter leituras pendentes para reprocessamento, sem gerar resultado substituto;
- bloquear o núcleo autenticado da aplicação enquanto a dependência estiver indisponível;
- proibir feature flags que habilitem regras como substituição em demonstração ou produção;
- permitir doubles/mocks somente em testes unitários isolados, nunca no build demonstrativo, no banco apresentado ou nos testes de aceitação.

---

## 10. Novo dataset sintético termográfico

### 10.1. Objetivo

Criar séries temporais plausíveis para treinar e avaliar um modelo experimental antes de receber dados reais da planta, além de gerar um cenário independente que será persistido no banco e processado ponta a ponta.

O dataset sintético não deverá ser descrito como evidência de eficácia industrial.

Dados sintéticos não significam dados mockados. O gerador deverá simular relações temporais e físicas, e a aplicação demonstrativa deverá consumir registros persistidos, chamar o modelo real e salvar os resultados calculados. Rótulos do gerador não poderão ser usados pelo runtime para decidir risco.

### 10.2. Estrutura de arquivos

```text
datasets/
├── raw/
│   └── synthetic_thermal_timeseries.csv
├── processed/
│   ├── thermal_training_windows.parquet
│   ├── thermal_validation_windows.parquet
│   └── thermal_test_windows.parquet
├── metadata/
│   └── synthetic_thermal_generation.json
└── demo/
    ├── reserved_plant_scenario.parquet
    └── reserved_plant_manifest.json
```

O arquivo AI4I antigo poderá ser arquivado fora do pipeline ativo ou removido após uma tag/backup da versão anterior.

### 10.3. Estrutura mínima das amostras

- `timestamp`;
- `plant_id`;
- `sector_id`;
- `equipment_type`;
- `panel_id`;
- `component_id`;
- `thermal_point_id`;
- `component_type`;
- `temperature_max_c`;
- `temperature_average_c`;
- `ambient_temperature_c`;
- `reference_temperature_c`;
- `delta_t_c`;
- `current_a`;
- `load_percent`;
- `emissivity`;
- `signal_quality`;
- `trend_c_per_hour`;
- `minutes_above_limit`;
- `consecutive_anomalies`;
- `failure_mode`;
- `anomaly_active`;
- `maintenance_required`;
- `failure_within_24h`;
- `failure_within_7d`.

Os campos de rótulo (`failure_mode`, `anomaly_active`, `maintenance_required` e horizontes de falha) pertencem ao pipeline de treino/avaliação. Eles não deverão ser enviados no payload de inferência nem expostos à regra de negócio do Next.js.

### 10.4. Geração física simplificada

A temperatura deverá resultar de fatores relacionados:

```text
temperatura =
  temperatura ambiente
  + aquecimento normal por carga
  + baseline específico do componente
  + degradação progressiva
  + comportamento do modo de falha
  + ruído do sensor
```

Não gerar cada coluna de forma independente.

### 10.5. Cenários normais

Simular:

- variação diária da temperatura ambiente;
- turnos e ciclos de produção;
- carga elétrica baixa, média e alta;
- aquecimento e resfriamento após acionamento;
- diferenças normais entre tipos de componente;
- pequenas interrupções de comunicação;
- ruído e precisão do sensor;
- períodos de manutenção e equipamento desligado.

### 10.6. Cenários de anomalia

#### Conexão frouxa/resistência elevada

- temperatura cresce com a corrente;
- `deltaT` aumenta progressivamente;
- pode haver oscilações com vibração/ciclo do processo;
- tende a piorar ao longo de dias.

#### Sobrecarga

- correlação forte com `loadPercent` e `currentA`;
- temperatura sobe durante períodos de alta carga;
- poderá normalizar quando a carga cai, mas reaparecer.

#### Desequilíbrio de fases

- um ponto ou fase permanece mais quente que equivalentes;
- comparação entre referências é mais informativa que temperatura absoluta.

#### Contato degradado

- elevação gradual do baseline;
- persistência mesmo sob carga semelhante;
- manutenção substitutiva normaliza o padrão.

#### Ventilação insuficiente

- vários componentes do mesmo painel aquecem simultaneamente;
- temperatura interna/ambiente do painel aumenta;
- o padrão difere de uma falha localizada.

#### Erro de sensor

- salto impossível;
- leitura congelada;
- valor fora da faixa;
- ruído excessivo;
- queda de qualidade ou ausência de comunicação.

Esse cenário deve ter rótulo próprio e não ser tratado automaticamente como falha do componente.

### 10.7. Representação dos 55 pontos

O gerador deverá criar 55 identidades persistentes de ponto. Exatamente 19 deverão possuir episódios anormais no cenário reservado da demonstração, mantendo variedade de causa e severidade. Esse cenário não poderá participar do treinamento.

Incluir obrigatoriamente:

- um episódio chegando a 75,6 °C;
- referência correspondente de 40 °C;
- `deltaT` de 35,6 °C;
- queda de temperatura após ação simulada.

O gerador cria somente medições, contexto e `ground truth` reservado para avaliação. A classificação crítica e a abertura do incidente deverão ser resultados da IA; a OS deverá surgir somente da confirmação humana durante a execução do aplicativo.

### 10.8. Janelas e rótulos

O alvo deve responder a uma pergunta operacional clara, por exemplo:

- haverá necessidade de intervenção nas próximas 24 horas?
- haverá falha confirmada nos próximos 7 dias?
- o ponto está entrando em comportamento anormal persistente?

Não usar a mesma fórmula exata que gera o rótulo como feature de entrada sem ruído ou atraso, pois isso criaria vazamento de alvo.

### 10.9. Separação de treino, validação e teste

Proibido usar divisão aleatória simples das linhas.

Aplicar:

- divisão cronológica;
- separação por painel ou ponto em parte do teste;
- ajuste de hiperparâmetros somente na validação;
- teste final intocado;
- registro da seed de geração;
- comparação com baseline de regras apenas na avaliação offline;
- separação adicional do cenário aplicado ao banco demonstrativo.

### 10.10. Modelos candidatos

- Logistic Regression como baseline interpretável;
- Random Forest;
- Gradient Boosting;
- Isolation Forest para anomalia sem rótulo;
- ensemble entre modelos validados com piso de segurança de engenharia, sempre exigindo inferência ML.

Não escolher por accuracy isolada.

### 10.11. Métricas

- precision;
- recall;
- F1;
- PR-AUC;
- ROC-AUC apenas como métrica complementar;
- matriz de confusão;
- falsos alertas por ponto/dia;
- eventos críticos não detectados;
- antecedência média da detecção;
- calibração do score;
- desempenho por tipo de componente;
- desempenho por faixa de carga.

---

## 11. Alterações no pipeline de treinamento

### 11.1. Arquivos novos

```text
services/predictive-ai/training/
├── generate_thermal_dataset.py
├── build_thermal_windows.py
├── load_reserved_scenario_to_db.py
├── train_thermal_models.py
├── evaluate_thermal_models.py
├── compare_rule_and_ml.py
└── validate_model_artifact.py
```

### 11.2. Parametrização

Remover caminhos de dataset fixos do treinamento. Aceitar argumentos ou configuração:

```text
--dataset
--output-dir
--target
--random-seed
--model-stage
--training-start
--training-end
```

### 11.3. Metadados do modelo

O novo `metadata.json` deverá registrar:

- `modelVersion`;
- `modelStage`;
- `isSyntheticModel`;
- `trainingDatasetHash` e `reservedScenarioHash` distintos;
- algoritmo;
- features e transformações;
- target e horizonte;
- período simulado;
- seed de geração;
- hash do dataset;
- métricas de validação e teste;
- thresholds escolhidos;
- data do treino;
- versão do código/commit;
- limitações conhecidas.

### 11.4. Distribuição do artefato

Definir uma das estratégias:

1. Git LFS no repositório privado;
2. GitHub Release privado;
3. armazenamento de objetos privado;
4. geração obrigatória durante build controlado.

Em qualquer estratégia:

- verificar checksum;
- falhar de forma clara se o modelo esperado estiver ausente em demonstração ou produção;
- não permitir fallback `RULE_ONLY`, `DemoPredictor` ou resposta hardcoded;
- impedir que um build seja considerado ready sem artefato e metadados correspondentes;
- validar que o cenário reservado aplicado ao banco não pertenceu ao treino.

---

## 12. Adequações no Next.js

### 12.1. Novas features

Criar seguindo o padrão `schema → repository → service → actions/API → components`:

```text
apps/web/src/features/
├── electrical-panels/
├── monitored-components/
├── thermal-points/
├── sensor-devices/
├── thermal-readings/
├── thermograms/
├── thermal-incidents/
├── ai-core/
├── human-reviews/
└── thermal-settings/
```

### 12.2. Novas rotas de interface

```text
/thermal-monitoring
/thermal-monitoring/map
/thermal-monitoring/points/[id]
/thermal-incidents
/thermal-incidents/[id]
/sensor-devices
/sensor-devices/[id]
/electrical-panels
/electrical-panels/[id]
/settings/thermal-risk
```

### 12.3. Página principal termográfica

Todos os contadores deverão ser calculados por consulta ao banco. Estados de risco deverão vir da última `Prediction` válida; o valor histórico `initiallyAnomalous` não poderá alimentar a classificação atual.

Exibir:

- total monitorado, esperado em 55 no cenário carregado;
- normais;
- atenção;
- altos;
- críticos;
- sem comunicação;
- incidentes abertos;
- pontos originalmente anormais: 19;
- distribuição da inspeção original: `2 × P20`, `10 × P10`, `7 × P5`;
- filtros e contadores da escala P5–P100, apresentados separadamente de normal/atenção/alto/crítico;
- maior temperatura atual;
- maior `deltaT`;
- tendência mais rápida;
- última atualização.
- estado/readiness da IA e idade da última inferência;
- leituras pendentes ou com falha de IA.

### 12.4. Mapa dos 55 pontos

Criar uma visão por setor/painel com estado de cada ponto. O MVP pode usar agrupamento hierárquico; uma planta baixa gráfica fica opcional.

Cada ponto deverá permitir acesso rápido a:

- temperatura atual;
- referência;
- `deltaT`;
- severidade;
- prioridade histórica da inspeção e prioridade empresarial atual/final, sem substituir a severidade da IA;
- origem da severidade e versão do modelo;
- estado do sensor;
- incidente aberto;
- gráfico temporal.

### 12.5. Detalhe do ponto

Abas recomendadas:

1. Visão geral;
2. Temperatura e `deltaT`;
3. Termogramas;
4. Predições e explicações;
5. Incidentes;
6. Ordens de serviço;
7. Configuração e calibração;
8. Auditoria.

O detalhe deverá deixar claro o que é histórico da inspeção, o que é medição atual, o que foi sugerido pela IA e o que foi decidido pelo humano. A aba de termogramas deverá exibir o arquivo autorizado, metadados/ROI, checksum e vínculo com a leitura e o achado da inspeção.

### 12.6. Gráficos

Exibir no mesmo eixo temporal:

- temperatura máxima;
- temperatura de referência;
- temperatura ambiente;
- limites de atenção/alto/crítico;
- carga ou corrente;
- marcações de alertas e manutenção.

Evitar gráfico de probabilidade média de todos os equipamentos, pois ele esconde pontos críticos. Priorizar máximos, percentis, incidências e tendências por ponto/painel.

### 12.7. Formulário manual

Substituir o formulário genérico atual por campos do domínio térmico. Vibração, RPM, torque e desgaste não devem aparecer no fluxo termográfico principal.

Campos mínimos:

- ponto termográfico;
- data/hora;
- temperatura máxima;
- temperatura média opcional;
- ambiente;
- referência;
- corrente/carga;
- emissividade;
- observações;
- imagem opcional;
- fonte da medição.

Ao salvar, a leitura deverá entrar no mesmo pipeline obrigatório da IA usado pela telemetria. O formulário não poderá pedir ou aceitar risco, causa prevista ou severidade final informados pelo usuário.

A imagem é opcional apenas para leituras numéricas de sensor que não produzam termograma. Para uma inspeção cuja fonte seja câmera termográfica, o arquivo ou uma referência importada verificável é obrigatório para que o achado seja considerado evidência completa.

### 12.8. Importação CSV

Criar schema próprio para dados térmicos. Permitir identificar o ponto pelo código e retornar erros por linha.

O backfill deverá:

- persistir em lote;
- não gerar uma chamada FastAPI por linha;
- recalcular janelas depois da importação;
- permitir execução explícita de backfill de predições;
- não enviar notificações antigas por padrão.

O backfill deverá processar lotes pelo modelo real. Não poderá converter cabeçalhos ou rótulos do CSV diretamente em risco operacional.

### 12.9. Simulador

Substituir os perfis `NORMAL`, `ATTENTION` e `CRITICAL` genéricos por cenários:

- normal sob baixa carga;
- normal sob alta carga;
- aquecimento progressivo;
- sobrecarga;
- conexão degradada;
- crítico de 75,6 °C;
- recuperação após manutenção;
- sensor offline;
- sensor com leitura inválida.

O simulador produz somente séries de leitura e as persiste pelo fluxo real. Ele não devolve severidade, `Prediction`, incidente ou alerta pronto; esses resultados devem ser descobertos pelo modelo.

---

## 13. Alertas, incidentes e notificações

### 13.1. Separação conceitual

- **Reading:** uma medição.
- **Prediction:** resultado analítico associado à leitura/janela.
- **Incident:** condição térmica persistente consolidada a partir de `Prediction` da IA.
- **Alert:** comunicação operacional sobre o incidente.
- **HumanReview:** confirmação, rejeição ou pedido de nova evidência pelo profissional.
- **WorkOrder:** ação de manutenção autorizada pelo humano depois da análise da IA.

### 13.2. Ciclo de vida

```text
LEITURA RECEBIDA
  -> PENDING_AI
  -> PREDICTION DA IA
  -> INCIDENTE / PENDING_HUMAN_REVIEW
  -> HUMAN_CONFIRMED
  -> OS CRIADA PELO HUMANO
  -> MONITORAMENTO PÓS-AÇÃO
  -> NORMALIZADO
```

Caminhos alternativos:

- `HUMAN_REJECTED`, com justificativa;
- `INCONCLUSIVE`;
- `NEW_READING_REQUIRED`;
- `AI_FAILED`, sem diagnóstico substituto;
- escalado para severidade maior;
- reaberto se a condição retornar.

### 13.3. Notificações

O MVP deverá ao menos registrar uma fila interna. Canais externos podem ser adicionados depois.

Regras:

- não notificar a cada leitura;
- notificar abertura, escalada e ausência prolongada do sensor;
- notificar defeito somente quando existir `Prediction` válida;
- respeitar horários, destinatários e severidade;
- registrar tentativa, sucesso e erro;
- permitir reenvio;
- manter link direto para o incidente.

---

## 14. Relatórios

Criar os seguintes relatórios em `features/reports`:

### 14.1. Relatório termográfico por ponto

- identificação completa;
- período;
- gráfico térmico;
- temperatura máxima;
- referência e `deltaT`;
- limites;
- incidentes;
- termogramas;
- intervenções;
- estado atual.
- proveniência das inferências e decisão humana.
- prioridade histórica, recomendada e final na escala P5–P100, com versão da política.

### 14.2. Relatório dos 55 pontos

- cobertura;
- distribuição por severidade;
- 19 pontos originalmente anormais;
- distribuição `2 × P20`, `10 × P10`, `7 × P5` e evolução posterior sem reescrever a inspeção original;
- evolução por período;
- ranking de risco;
- sensores offline;
- incidentes abertos e resolvidos.

### 14.3. Relatório de ocorrência

- linha do tempo completa;
- dados que dispararam o alerta;
- explicação do motor de risco;
- decisão humana (`CONFIRMED`, `REJECTED`, `INCONCLUSIVE` ou `NEW_READING_REQUIRED`), com autor e justificativa;
- OS relacionada;
- diagnóstico;
- antes e depois da intervenção.

### 14.4. Identificação obrigatória

Relatórios gerados com dados sintéticos deverão conter marca visível:

> Ambiente demonstrativo — dados sintéticos, não validados em operação industrial.

---

## 15. Reset do banco e carga do cenário sintético

### 15.1. Momento correto

Não resetar o banco antes de concluir:

- novo schema;
- migrations;
- seed termográfico;
- atualização dos serviços que dependem dos modelos removidos;
- testes mínimos de criação e consulta.

Isso evita múltiplos resets e períodos em que a aplicação não consegue iniciar.

### 15.2. Preservação mínima

Antes do reset:

- criar tag ou branch da versão anterior;
- manter o ZIP original;
- exportar schema e dados apenas se houver algo não reproduzível;
- registrar versão do modelo anterior;
- nunca copiar segredos para o backup versionado.

### 15.3. Estratégia de migration

Como a mudança de domínio é extensa e o banco pode ser zerado:

1. consolidar o novo `schema.prisma`;
2. criar uma migration-base limpa para o novo domínio;
3. validar em PostgreSQL local ou branch temporária do Neon;
4. rodar testes;
5. recriar a branch/banco de desenvolvimento;
6. aplicar migrations;
7. executar o novo seed.

Evitar manter dezenas de migrations intermediárias experimentais no histórico final.

### 15.4. Seed técnico e simulador temporal

Neste documento, `seed` significa o mecanismo técnico de cadastro e carga no banco. Ele não representa dado mockado nem pode carregar resultados esperados da IA.

O seed deverá criar:

- usuários demo e usuário de sistema;
- setores da planta demonstrativa;
- autoclaves, estufas, câmaras frias e pelo menos 20 centrífugas, ou uma amostra representativa com quantidades documentadas;
- painéis relacionados;
- componentes elétricos;
- exatamente 55 pontos;
- 19 pontos marcados como inicialmente anormais;
- sensores/dispositivos de demonstração;
- limites térmicos configuráveis;
- leituras sintéticas temporais coerentes, persistidas no banco pelo fluxo real;
- fase pré-ação do cenário de 75,6 °C versus 40 °C;
- manifesto separado com o `ground truth`, inacessível ao caminho de inferência.

O seed não deverá criar `Prediction`, incidente, alerta ou OS preditiva. Esses registros nascerão da execução real do modelo e da confirmação humana. A fase pós-ação da simulação somente será liberada depois que a OS for concluída, evitando que dados futuros vazem para a análise inicial.

O seed e o simulador deverão ser determinísticos. Usar gerador pseudoaleatório com seed fixa em vez de `Math.random()` não controlado. A interface e o FastAPI não poderão consultar a seed ou o manifesto para descobrir o resultado esperado.

### 15.5. Comando destrutivo

Somente depois da validação e com o alvo de banco confirmado:

```bash
cd apps/web
npx prisma migrate reset
```

Não executar esse comando contra banco de produção ou contra uma URL não verificada.

---

## 16. Segurança

### 16.1. Dispositivos

- chave individual por dispositivo;
- armazenamento somente do hash;
- rotação e revogação;
- escopo limitado ao ponto autorizado;
- rate limiting;
- proteção contra replay com sequência/timestamp;
- idempotência;
- logs de autenticação sem expor a chave.

### 16.2. Usuários

Preservar os papéis atuais e acrescentar permissões como:

```text
panel:read
panel:manage
thermal-point:read
thermal-point:manage
thermal-reading:create
thermal-reading:import
incident:review
incident:confirm
incident:reject
incident:convert-to-work-order
device:manage
thermal-settings:manage
model:inspect
model:operate
```

### 16.3. Uploads

- validar tipo real do arquivo;
- impor limite de tamanho;
- usar nomes internos não controlados pelo usuário;
- não servir upload com execução;
- restringir acesso aos termogramas;
- registrar autor/dispositivo e checksum.

### 16.4. Auditoria

Adicionar `AuditLog` para:

- criação e edição de painéis/componentes/pontos;
- provisionamento e revogação de dispositivos;
- alteração de limites;
- importações;
- confirmação, rejeição, inconclusão e solicitação de nova leitura;
- conversão em OS;
- confirmação de causa;
- promoção de modelo;
- execução de backfill.

---

## 17. Performance e retenção

### 17.1. Índices mínimos

- `ThermalReading(thermalPointId, measuredAt)`;
- `ThermalReading(sensorDeviceId, sequence)` único;
- `ThermalIncident(thermalPointId, status)`;
- `ThermalIncident(severity, status)`;
- `SensorDevice(status, lastSeenAt)`;
- `Prediction(thermalPointId, createdAt)`.

### 17.2. Agregações

Criar agregados horários e diários contendo:

- mínimo;
- máximo;
- média;
- percentil alto;
- maior `deltaT`;
- tempo acima do limite;
- quantidade de anomalias.

### 17.3. Retenção inicial sugerida

- leituras brutas: 90 dias no piloto;
- agregados horários: 1 ano;
- agregados diários, incidentes, alertas e OS: retenção longa;
- termogramas: conforme política de evidência da empresa.

Os prazos finais deverão ser definidos com a indústria e com a capacidade do ambiente contratado.

A fila de telemetria não poderá depender do cron diário para manter a vazão operacional. O cron serve para reconciliação, retenção e recuperação; processamento contínuo exige consumidor durável dimensionado acima da taxa de entrada.

---

## 18. Observabilidade

Registrar métricas técnicas e operacionais:

- leituras recebidas por minuto;
- rejeições por motivo;
- duplicações;
- atraso de ingestão;
- sensores online/offline;
- latência do FastAPI;
- falhas de inferência;
- leituras em `PENDING_AI` e tempo de espera pela IA;
- disponibilidade do artefato obrigatório;
- divergências de versão ou checksum;
- distribuição de score;
- incidentes por severidade;
- achados e incidentes por prioridade P5–P100;
- indicações rejeitadas pelo profissional;
- eventos críticos não detectados;
- versão do modelo em uso.
- tamanho/idade do backlog e taxa de recuperação de `AI_FAILED`;
- interrupções não planejadas relacionadas à implantação.

O endpoint `/health` deverá informar:

- estado do serviço;
- versão;
- tipo de predictor;
- versão e estágio do modelo;
- se o modelo usa dados sintéticos;
- checksum do artefato;
- horário de carregamento;
- prontidão real para inferência;
- motivo do bloqueio quando o núcleo de IA estiver indisponível.

O serviço somente poderá informar `ready=true` depois de carregar e validar o artefato real. Ausência de modelo, checksum divergente ou predictor de demonstração deverá resultar em `ready=false`; o health check não poderá mascarar a falha com regras ou resposta simulada.

Não expor caminhos internos, segredos ou detalhes sensíveis no health público.

---

## 19. Testes necessários

### 19.1. Unitários — Next.js

- cálculo de `deltaT`;
- validação de limites;
- precedência de configuração;
- deduplicação de incidente;
- escalada;
- histerese;
- normalização;
- sensor offline;
- idempotência da telemetria;
- validação de CSV;
- permissões;
- estados `PENDING_AI`, `ANALYZED` e `AI_FAILED`;
- rejeição de `Prediction` sem proveniência válida;
- decisão humana obrigatória;
- bloqueio de OS preditiva sem `CONFIRMED`.
- escala P5–P100 e política versionada;
- distribuição histórica `2 × P20`, `10 × P10`, `7 × P5`;
- separação entre prioridade histórica, risco atual, prioridade recomendada e prioridade final;
- validação e autorização de metadados/upload de termograma.

### 19.2. Unitários — FastAPI

- carregamento do artefato treinado;
- validação de versão e checksum;
- extração das features temporais;
- inferência com score, risco e modo de falha;
- proteções de plausibilidade aplicadas depois da inferência;
- payload sem dados suficientes;
- qualidade inválida;
- falha fechada quando o modelo estiver ausente, corrompido ou incompatível;
- rejeição de predictor `DEMO`, `RULE_ONLY` ou resposta hardcoded;
- metadados do modelo;
- explicações obrigatórias.

### 19.3. Integração

- telemetria → leitura;
- leitura → agregação;
- agregação → FastAPI;
- resposta → Prediction;
- Prediction → incidente consolidado;
- incidente → alerta;
- incidente/alerta → revisão humana;
- revisão `CONFIRMED` → OS preditiva;
- revisão `REJECTED`/`INCONCLUSIVE` → OS bloqueada;
- conclusão da OS → feedback;
- sensor offline → alerta técnico;
- indisponibilidade da IA → leituras pendentes, sem Prediction, incidente, alerta analítico ou OS;
- dados simulados persistidos → inferência real, sem inserts de resultado pronto.
- inspeção/termograma → TAG/leitura/Prediction/incidente/OS/relatório rastreáveis;
- risco da IA → política versionada → prioridade P5–P100 → decisão humana, sem equivalência hardcoded;
- fila durável → retentativa de falha → recuperação sem duplicar leitura ou incidente.

### 19.4. E2E

Criar suíte Playwright para:

1. login;
2. abrir mapa térmico;
3. localizar o ponto crítico;
4. acessar gráfico e explicação;
5. conferir a proveniência da inferência;
6. confirmar ou rejeitar o defeito indicado pela IA;
7. criar OS somente após confirmação;
8. concluir intervenção;
9. validar monitoramento pós-ação;
10. confirmar normalização;
11. interromper a IA e comprovar que novas análises e o fluxo preditivo ficam bloqueados.
12. conferir a inspeção original `2 × P20`, `10 × P10`, `7 × P5` sem confundi-la com risco atual;
13. abrir termograma autorizado e reconstruir seu vínculo com TAG, leitura, Prediction, decisão e OS.

### 19.5. Testes de carga

Simular pelo menos:

- 55 pontos a cada minuto;
- reconexão de gateway enviando lote atrasado;
- importação de histórico;
- vários pontos críticos simultâneos;
- indisponibilidade temporária do FastAPI, mantendo as leituras no banco para reprocessamento e sem fabricar resultados.
- consumidor contínuo sustentando taxa maior ou igual a 55 leituras/minuto por período suficiente para provar ausência de backlog crescente;
- recuperação de `AI_FAILED` e reinício do worker sem perda, duplicação ou dependência de processo em memória.

---

## 20. Alterações por arquivo/módulo existente

| Arquivo ou módulo                                       | Adequação                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/web/prisma/schema.prisma`                         | Adicionar inspeção original, prioridade P5–P100, termogramas, dispositivos e fila durável |
| `apps/web/prisma/seed.ts`                               | Preservar séries simuladas e carregar os 19 achados históricos 2×P3/P20, 10×P4/P10 e 7×P5/P5, sem semear resultados analíticos |
| `features/thermal-inspections`                          | Registrar inspeções/achados imutáveis, termogramas e política empresarial versionada |
| `features/thermal-analysis-jobs`                        | Reservar, processar, repetir e auditar análises sem depender da memória serverless |
| `features/sensor-readings`                              | Migrar responsabilidades para `thermal-readings` ou manter apenas legado  |
| `features/predictions/schemas/predictive-ai.schema.ts`  | Novo contrato de risco térmico                                            |
| `features/predictions/services/predictive-ai.client.ts` | Enviar janela real, exigir proveniência e tratar indisponibilidade como bloqueio |
| `features/predictions/services/prediction.service.ts`   | Persistir somente inferência válida e originar incidente pendente de revisão humana |
| `features/alerts/services/alert.service.ts`             | Relacionar alerta ao incidente da IA; impedir criação analítica manual |
| `features/dashboard/services/dashboard.service.ts`      | Consultar somente banco/Prediction; mostrar prontidão e estados pendentes |
| `/predictive-maintenance`                               | Redirecionar/evoluir para dashboard termográfico                          |
| `/equipments/[id]`                                      | Incluir painéis, pontos, termogramas e incidentes                         |
| `features/reports`                                      | Novos PDFs térmicos                                                       |
| `features/thermograms`                                  | Upload privado, autorização, checksum, metadados, ROI e vínculo por TAG   |
| `services/predictive-ai/app/schemas`                    | Substituir entrada genérica por contrato térmico temporal                 |
| `services/predictive-ai/app/ml/predictor.py`            | Criar predictor térmico baseado obrigatoriamente no artefato ML           |
| `services/predictive-ai/app/ml/model_loader.py`         | Validar estágio, checksum e metadados; falhar fechado                     |
| `services/predictive-ai/training/prepare_dataset.py`    | Gerar treino sintético e cenário demonstrativo reservado e separado       |
| `services/predictive-ai/training/train.py`              | Parametrizar e treinar modelos térmicos                                   |
| `services/predictive-ai/models/metadata.json`           | Novo formato com origem sintética explícita                               |
| `apps/web/.env.example`                                 | Variáveis de telemetria, retenção, armazenamento e bloqueio AI-first       |
| `services/predictive-ai/.env.example`                   | Artefato obrigatório, estágio, checksum e modo fail-closed              |
| `docker-compose.yml`                                    | Incluir gateway/broker somente se a decisão de infraestrutura do piloto exigir; MQTT não é requisito funcional |
| `docs/architecture.md`                                  | Atualizar arquitetura e fluxo                                             |
| `docs/predictive-maintenance.md`                        | Substituir pelo fluxo termográfico                                        |
| `docs/checklist-pendencias.md`                          | Separar débitos legados dos requisitos GPMS 2026                          |

---

## 21. Novas variáveis de ambiente sugeridas

### Next.js

```text
TELEMETRY_MAX_BATCH_SIZE=500
TELEMETRY_MAX_CLOCK_SKEW_SECONDS=300
DEVICE_OFFLINE_MULTIPLIER=3
THERMAL_RAW_RETENTION_DAYS=90
THERMOGRAM_STORAGE_PROVIDER=...
THERMOGRAM_MAX_FILE_SIZE_MB=10
THERMAL_ANALYSIS_QUEUE_PROVIDER=...
THERMAL_ANALYSIS_MAX_ATTEMPTS=5
THERMAL_ANALYSIS_BACKOFF_SECONDS=30
THERMAL_BACKFILL_NOTIFICATIONS=false
```

### FastAPI

```text
MODEL_PATH=models/thermal_model.joblib
MODEL_METADATA_PATH=models/thermal_metadata.json
MODEL_STAGE=SYNTHETIC_EXPERIMENTAL
AI_MODEL_REQUIRED=true
AI_FAIL_CLOSED=true
EXPECTED_MODEL_CHECKSUM=...
```

Não deverá existir variável capaz de habilitar `DemoPredictor`, `RULE_ONLY`, resposta mockada ou continuidade do fluxo preditivo sem o artefato validado.

Segredos não devem ser incluídos nos arquivos `.env.example` além de placeholders.

---

## 22. Checklist consolidado por etapa — fonte oficial

> Esta seção substitui o checklist legado por fases. O detalhamento executável fica em `docs/checklist-pendencias.md`; em caso de divergência, prevalecem a revisão contratual de 09/09/2026 e as Etapas 9–12 deste documento.

### Etapas encerradas

- [x] Etapas 1–8: domínio termográfico, 55 pontos, simulação persistida, inferência ML experimental, rastreabilidade, incidente, revisão humana e OS condicionada.
- [x] Etapa 9: inspeção histórica 2/10/7, escala P5–P100, telemetria autenticada/idempotente, fila durável e consumidor Vercel Queues.
- [x] Caso demonstrativo: 75,6 °C contra referência de 40 °C, com ΔT de 35,6 °C.
- [x] Resultado demonstrativo identificado como sintético/experimental, sem alegação de eficácia industrial.

### Etapa 9 — prioridade empresarial e monitoramento contínuo

- [x] Implementar a escala empresarial P5–P100 separada do risco calculado pela IA e da prioridade da OS.
- [x] Registrar a inspeção original imutável com exatamente 2 achados P3/P20, 10 P4/P10 e 7 P5/P5.
- [!] Obter da empresa o significado operacional de P30, P50 e P100. O software já os reconhece e bloqueia definições inventadas; a validação externa continua na Etapa 12.
- [x] Implementar telemetria autenticada, idempotente, segura e independente de fornecedor.
- [x] Persistir cada lote e seu trabalho analítico em fila durável antes de responder sucesso.
- [x] Processar continuamente com consumidor Vercel Queues, retentativa automática e métricas para 55 pontos/minuto; executar soak no deploy na Etapa 11.
- [x] Usar o cron diário apenas para reconciliação, retenção e recuperação, nunca como mecanismo principal de monitoramento.

### Etapa 10 — termogramas, relatórios e feedback

- [ ] Armazenar termogramas de forma privada, com checksum, metadados, ROI e vínculo auditável ao TAG, inspeção e leitura.
- [ ] Exibir na mesma linha do tempo inspeção, termograma, leitura, inferência, prioridade empresarial, decisão humana, incidente e OS.
- [ ] Emitir relatório individual e consolidado com a classificação histórica P5–P100 e a política aplicada.
- [ ] Registrar justificativa e auditoria quando a decisão humana divergir da recomendação.

### Etapa 11 — qualidade, segurança e demonstração

- [ ] Cobrir por testes a escala P, a distribuição 2/10/7, o acesso a termogramas, a fila durável e a recuperação de falhas.
- [ ] Executar E2E de telemetria até OS confirmada e E2E fail-closed sem o núcleo de IA.
- [ ] Demonstrar os 55 pontos, os 19 achados históricos e o caso crítico sem confundir histórico com estado atual.
- [ ] Remover ou ocultar caminhos legados que não tenham dependência ativa e possam confundir o desafio.

### Etapa 12 — piloto industrial

- [ ] Validar TAGs, termogramas, referências e prioridades com os responsáveis da planta.
- [ ] Executar análise de risco, plano NR-10, instalação progressiva, rollback físico/lógico e janelas autorizadas.
- [ ] Comprovar zero interrupção não planejada e nenhuma alteração indevida das proteções elétricas.
- [ ] Comparar sensores com termografia de referência e medir disponibilidade, latência, falso positivo e falso negativo.
- [ ] Aprovar metas, responsáveis e período de medição antes de promover qualquer modelo treinado com dados reais.

---
## 23. Critérios de aceite da solução final

### Cobertura e aderência ao caso

- [x] Existem exatamente 55 pontos no cenário demonstrativo.
- [x] Existem 19 pontos sinalizados no cenário atual e o caso de 75,6 °C contra 40 °C está reproduzido.
- [ ] A inspeção original registra, sem alteração retroativa, exatamente 2 achados “Prioridade 3/P20”, 10 “Prioridade 4/P10” e 7 “Prioridade 5/P5”.
- [ ] A escala P5–P100 é compatível com o processo da empresa e sua política versionada está visível.
- [ ] Autoclaves, estufas, câmaras frias, quadros de produção e pelo menos 20 centrífugas podem ser cadastrados e monitorados pela mesma solução.
- [ ] A rastreabilidade por TAG reconstrói inspeção, termograma, leitura, recomendação, inferência, decisão, incidente, OS e resultado.

### Monitoramento contínuo e análise

- [ ] Leituras manuais, importadas, simuladas e de dispositivos percorrem o mesmo contrato de entrada e o mesmo núcleo de IA.
- [ ] A ingestão autenticada e idempotente sustenta 55 pontos/minuto sem crescimento contínuo da fila.
- [ ] O trabalho analítico fica persistido em fila durável antes da resposta de sucesso.
- [ ] Retentativas e reprocessamento recuperam automaticamente falhas transitórias e registros `AI_FAILED`.
- [ ] O cron diário apenas reconcilia pendências; a análise contínua não depende dele.
- [x] A demonstração calcula ΔT, tendência e persistência e produz `Prediction` com proveniência.
- [ ] A solução preserva dados quando a IA está indisponível e não inventa classificação, incidente ou OS.

### Priorização, alertas e decisão humana

- [ ] Prioridade empresarial P5–P100, risco da IA e prioridade da OS são conceitos separados na API, banco, interface e relatórios.
- [ ] Uma política versionada transforma evidência em prioridade recomendada sem equivalências arbitrárias.
- [ ] Incidentes aplicam persistência, deduplicação, escalonamento e histerese.
- [ ] Sensor offline, leitura inválida ou inferência vencida nunca aparecem como condição normal.
- [ ] Toda mudança humana de prioridade ou diagnóstico possui autor, horário e justificativa.
- [ ] Somente defeito confirmado por pessoa autorizada pode originar OS preditiva.

### Evidência termográfica e interface

- [ ] Termogramas ficam em armazenamento privado com checksum, metadados, controle de acesso e vínculo ao TAG.
- [ ] O detalhe do ponto mostra temperatura, referência, ΔT, tendência, carga, termograma e histórico de decisões.
- [ ] O dashboard distingue os 19 achados da inspeção histórica do estado corrente calculado pela IA.
- [ ] Relatórios por ponto e consolidados apresentam política e prioridade históricas, recomendadas e finais.
- [ ] O estágio sintético/experimental do modelo é explícito e não é apresentado como validação industrial.

### Implantação e validação industrial

- [ ] A instalação foi aprovada por responsável técnico e segue NR-10 e procedimentos internos.
- [ ] O sensoriamento é adequado para proximidade de quadros energizados e não substitui nem altera proteções elétricas.
- [ ] A implantação progressiva possui rollback e não causa interrupção não planejada.
- [ ] O piloto compara leituras contínuas com termografia manual de referência.
- [ ] Metas para cobertura, disponibilidade, latência, falsos positivos, falsos negativos e tempo até correção foram aprovadas.
- [ ] Modelo treinado com dados reais só é promovido após superar critérios técnicos definidos, com rollback disponível.

### Qualidade e segurança

- [ ] Testes unitários, integração, E2E, segurança e carga das jornadas críticas passam.
- [ ] Não existem segredos versionados, resultados analíticos semeados, respostas falsas ou fallback operacional por regras.
- [ ] Acesso a dispositivos, termogramas, revisões e OS obedece autenticação, autorização e auditoria.
- [ ] Backup, retenção, observabilidade e recuperação da fila foram testados no ambiente de implantação.

---
## 24. Indicadores de sucesso do piloto

O piloto deverá acompanhar:

- percentual de pontos monitorados continuamente;
- cobertura por área e por tipo de ativo, incluindo as mais de 20 centrífugas;
- disponibilidade dos sensores;
- disponibilidade do pipeline completo de ingestão e análise;
- latência entre medição, inferência, alerta e decisão humana;
- antecedência do alerta;
- falsos alertas por ponto/dia;
- taxa de falsos negativos comparada à termografia de referência;
- percentual de alertas confirmados pelos técnicos;
- tempo entre indicação da IA e decisão humana;
- taxa de confirmação, rejeição e inconclusão das indicações;
- tempo entre alerta e OS;
- tempo entre detecção e correção;
- quantidade de pontos que evoluem para prioridade empresarial mais urgente entre inspeções;
- tempo acima do limite crítico;
- reincidência após manutenção;
- quantidade de inspeções manuais direcionadas pelo sistema;
- falhas encontradas antes de uma parada;
- diferença entre leitura contínua e termografia manual de referência.

Cada indicador deverá ter fórmula, fonte, baseline, meta, período de apuração e responsável aprovados. A meta de interrupções não planejadas causadas pela implantação é obrigatoriamente zero.

Evitar afirmar “incêndios evitados” sem evidência causal documentada.

---

## 25. Riscos e mitigação

| Risco                                                 | Mitigação                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| Modelo sintético parecer mais preciso que a realidade | Identificar estágio e não usar métricas como validação industrial |
| Temperatura variar apenas pela carga                  | Registrar corrente/carga e construir baseline condicionado        |
| Alarme excessivo                                      | Persistência, deduplicação e histerese                            |
| Sensor com erro gerar OS                              | Qualidade, guardas de plausibilidade e confirmação humana         |
| Ausência ou corrupção do modelo `.joblib`              | Health `not ready`, fail-closed, fila de reprocessamento e alerta técnico |
| Mock ou hardcode mascarar o funcionamento             | Proibir resultados semeados, testar proveniência e inspecionar o build demonstrativo |
| Cenário de demonstração vazar para o treino             | Reservar seed/período/pontos e validar hashes dos conjuntos           |
| Usuário contornar a IA e abrir OS preditiva manual | Invariante transacional exige `Prediction` válida e revisão humana `CONFIRMED` |
| Crescimento rápido da tabela                          | Índices, agregações e retenção                                    |
| Vazamento de dados no treino                          | Split temporal e por ponto/painel                                 |
| Instalação insegura em painel                         | Responsável técnico, NR-10 e procedimentos da planta              |
| Termograma expor informação industrial                | Controle de acesso e armazenamento privado                        |
| Rede instável                                         | Buffer no gateway, lote, sequência e idempotência                 |
| Limites globais inadequados                           | Override por componente/ponto e validação da engenharia           |
| Confundir P5–P100 com risco da IA ou prioridade da OS | Conceitos separados e política empresarial versionada             |
| Inventar significado para P30/P50/P100                 | Obter definição oficial e bloquear publicação da política incompleta |
| Cron diário criar falsa aparência de continuidade      | Ingestão e fila duráveis; cron somente para reconciliação          |
| Backlog crescer acima da capacidade analítica          | Métricas de idade/vazão, autoscaling compatível e teste de carga   |
| Instalação causar parada ou interferir em proteção     | Plano aprovado, implantação progressiva, rollback e meta de zero interrupção |
| Perder vínculo entre termograma e TAG                  | Armazenamento privado, checksum e relações imutáveis auditáveis    |

---

## 26. Definição de pronto da adequação

A aplicação estará 100% aderente ao desafio somente quando todos os itens abaixo forem comprovados em ambiente equivalente ao piloto:

1. Os 55 pontos e sua hierarquia por área, equipamento, painel, componente e TAG estão cadastrados e auditáveis.
2. A inspeção original permanece como evidência histórica imutável: 19 achados, sendo exatamente 2 Prioridade 3/P20, 10 Prioridade 4/P10 e 7 Prioridade 5/P5.
3. O caso crítico mantém 75,6 °C, referência de 40 °C e ΔT de 35,6 °C, acompanhado do termograma e da recomendação originais.
4. A empresa validou o significado e o uso de toda a escala P5–P100; a versão da política acompanha cada decisão.
5. Prioridade empresarial, risco da IA e prioridade da OS são armazenados e apresentados separadamente.
6. A solução suporta autoclaves, estufas, câmaras frias, quadros e mais de 20 centrífugas sem lógica específica por ativo.
7. Leituras manuais, importadas e contínuas entram por contratos consistentes, com origem, horário, qualidade e idempotência.
8. A ingestão e a fila duráveis sustentam ao menos 55 pontos/minuto sem perda nem crescimento sustentado do backlog.
9. O cron diário funciona somente como reconciliação; telemetria, análise, alertas e recuperação operam fora dessa janela.
10. A IA analisa janelas temporais e registra proveniência completa; regras são guardas de engenharia e não falsificam predições.
11. Se a IA falhar, os dados são preservados e reprocessados, mas nenhuma classificação, priorização, ocorrência ou OS é inventada.
12. Incidentes aplicam deduplicação, persistência, histerese e escalonamento, distinguindo dado vencido, sensor offline e condição normal.
13. A pessoa autorizada revisa evidências e justifica confirmação, rejeição, inconclusão ou mudança de prioridade.
14. A OS preditiva nasce somente de defeito confirmado e preserva TAG, evidências, inferência, política e decisão que a originaram.
15. Termogramas ficam em armazenamento privado e podem ser relacionados por auditoria à inspeção, leitura, inferência, incidente e manutenção.
16. Relatórios mostram a evolução térmica e a linha do tempo completa até a correção e a validação pós-manutenção.
17. A interface identifica claramente dados simulados e modelo sintético/experimental, sem alegar validação industrial.
18. O piloto foi instalado por processo seguro e aprovado, sem modificar proteções e com zero interrupção não planejada.
19. Leituras contínuas foram comparadas com termografia manual e os indicadores reais possuem baseline, meta, período e responsável.
20. Existe decisão técnica documentada para expansão, incluindo todas as centrífugas, e rollback físico, lógico e de modelo.

Enquanto qualquer item obrigatório estiver pendente, o produto pode ser apresentado como demonstração funcional ou piloto em validação, mas não como solução industrial integralmente comprovada.

Essa definição mantém a IA como suporte preditivo indispensável e preserva a decisão e a autorização de manutenção sob responsabilidade humana.
