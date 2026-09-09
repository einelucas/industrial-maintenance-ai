# Prompt de implementação — Prontidão da demonstração e preparação de deploy

Prepare o projeto para uma demonstração funcional e repetível do fluxo termográfico já implementado, sem antecipar telemetria física, piloto em planta ou aprendizado com dados reais. Execute este prompt integralmente; não entregue apenas um plano.

Leia `Adequaçoes.md`, `README.md`, `docs/architecture.md`, o prompt da Etapa 8 e a cadeia `ThermalReading -> Prediction -> ThermalIncident -> HumanReview -> WorkOrder`. Preserve as invariantes AI-first: nenhum resultado analítico pode ser semeado, inventado, calculado apenas por regras ou criado quando o FastAPI/modelo estiver indisponível.

## Resultado obrigatório

Ao final, uma pessoa deve conseguir confirmar, antes da apresentação e sem alterar o banco, que o ambiente contém o cenário oficial e está apto a demonstrar:

`login -> monitoramento dos 55 pontos -> TP-039 -> evidência da IA -> revisão humana -> criação de OS preditiva`.

O projeto também deve ficar preparado para o próximo passo de deploy, com o bundle térmico reproduzido e validado durante a construção da imagem do FastAPI. O agendamento da Vercel deve consumir apenas uma execução automática diária, reunindo o scheduler preventivo e o processamento térmico no mesmo endpoint protegido.

## Verificador da demonstração

- Criar um comando versionado e somente leitura, por exemplo `pnpm demo:verify`.
- Carregar explicitamente a configuração local sem imprimir banco, chaves ou segredos.
- Validar readiness real do FastAPI pelo gateway Next.js.
- Validar no PostgreSQL: 55 pontos, 19 marcadores reservados no manifesto operacional, existência do TP-039, caso 75,6 °C / referência 40 °C / deltaT 35,6 °C, Prediction térmica rastreável, incidente crítico e vínculo do painel com um equipamento real.
- Confirmar que o incidente está em estado utilizável para o roteiro. Distinguir claramente cenário fresco (`PENDING_HUMAN_REVIEW`, sem revisão e sem OS) de cenário já consumido.
- Informar contagens de leituras `PENDING_AI`, `ANALYZED` e `AI_FAILED` apenas como diagnóstico. O backlog não deve bloquear a demonstração do caso oficial já preparado.
- Retornar código diferente de zero quando uma pré-condição obrigatória falhar.
- Nunca executar backfill, revisão, criação de OS, seed, migration ou qualquer escrita.

## Empacotamento do FastAPI

- Corrigir a diferença entre a política documentada e o Dockerfile atual: `thermal_model.joblib` é ignorado pelo Git, portanto uma imagem construída a partir de um checkout limpo deve treinar e validar o bundle antes de iniciar.
- Usar a raiz do repositório como contexto Docker para disponibilizar o serviço e somente os datasets necessários ao treino/validação.
- Excluir do contexto segredos, ambientes virtuais, dependências Node, caches e datasets brutos desnecessários.
- Fazer o build falhar se treino ou validação do artefato falhar.
- Manter o runtime fail-closed e o health degradado quando um artefato válido não estiver disponível.
- Atualizar `docker-compose.yml` e documentar o comando de build a partir da raiz.

## Uma única automação diária na Vercel

- Substituir os dois agendamentos do `vercel.json` por um único cron diário.
- Criar um endpoint agregador autenticado por `Authorization: Bearer CRON_SECRET`.
- No mesmo disparo, executar a geração de OS preventivas vencidas e um lote limitado do processamento térmico.
- Manter as rotinas idempotentes e fail-closed. Falha/indisponibilidade da IA não pode criar Prediction alternativa e não deve impedir o relatório explícito do resultado preventivo.
- Retornar um resumo estruturado das duas rotinas.
- Manter endpoints antigos apenas para compatibilidade/chamada manual, sem registrá-los como cron automático.
- Adicionar testes para autenticação, execução única das duas rotinas e resposta estruturada.

## Operação da demonstração

- Documentar que `AI_SERVICE_URL` tem precedência sobre `PREDICTIVE_AI_URL`.
- Incluir um roteiro curto de pré-voo e apresentação.
- Explicar que o TP-039 preparado pode ser consumido uma única vez no banco atual; revisão e OS são registros auditáveis e não devem ser apagados automaticamente para repetir a demo.
- Documentar como usar um banco/branch demonstrativo separado para ensaios repetidos.
- Não processar todo o backlog automaticamente nesta implementação.

## Verificação e registro

- Executar testes TypeScript sem integração externa, typecheck, lint, testes Python e build Next.js.
- Executar o novo verificador contra FastAPI real e banco configurado, sem escrita.
- Validar o Dockerfile por build real quando Docker estiver disponível; caso contrário, registrar precisamente a limitação.
- Atualizar `README.md`, `docs/architecture.md`, `Adequaçoes.md`, exemplos de ambiente e checklist pertinente.
- Registrar neste arquivo a data de consumo, os testes executados e qualquer limitação que permaneça. Só declarar como comprovado o que foi efetivamente executado.

## Registro de consumo

Prompt consumido em **09/09/2026**.

Entregas executadas:

- pré-voo `pnpm demo:verify`, estritamente somente leitura;
- único cron diário `/api/cron/daily-maintenance`, agregando scheduler preventivo e backfill térmico;
- isolamento de falhas e resposta estruturada das duas rotinas;
- Dockerfile com treino + validação obrigatórios do bundle em contexto de monorepo limpo;
- `.dockerignore`, `docker-compose.yml`, exemplos de ambiente e documentação operacional atualizados;
- build Next.js isolável por `NEXT_DIST_DIR`, sem sobrescrever o cache de ensaio.

Verificações executadas:

- **331 testes TypeScript em 35 arquivos**, todos aprovados;
- **18 testes Python**, todos aprovados; apenas avisos de cache do pytest sem permissão de escrita;
- typecheck e lint completos sem erros;
- validação do artefato `PASS`, 31 features, checksum e fingerprint reproduzível coerentes;
- build de produção Next.js aprovado com 43 rotas, incluindo o novo cron; permaneceram somente os avisos já conhecidos do `bcryptjs` no Edge Runtime;
- pré-voo real contra FastAPI e Neon retornou `READY`, sem escrita: 55 pontos, 19 marcadores, TP-039 crítico e incidente fresco para revisão/OS.

Limitações registradas:

- o executável Docker não está instalado neste ambiente, portanto a imagem não pôde ser construída localmente; o build real deve ser a primeira verificação no serviço de deploy;
- não havia navegador conectado para um E2E visual autenticado; o roteiro final permanece para ensaio humano antes da apresentação;
- o backlog térmico não foi processado e não bloqueia o caso oficial já preparado.
