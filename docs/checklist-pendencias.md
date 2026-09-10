# Checklist — aderência estrita ao desafio GPMS 2026

> Revisão contratual: 09/09/2026. Esta é a lista operacional de pendências após a Etapa 9. Itens legados sem relação direta com o desafio foram retirados do caminho crítico e aparecem no fim como descartados ou adiados.

## Estado confirmado ao encerrar a Etapa 9

- [x] Domínio termográfico, hierarquia da planta e 55 pontos cadastrados.
- [x] Cenário sintético persistido com 19 sinais anormais atuais.
- [x] Caso crítico TP-039 reproduzido em 75,6 °C contra referência de 40 °C, com ΔT de 35,6 °C.
- [x] Modelo térmico carregado como `SYNTHETIC_EXPERIMENTAL`, com inferência e proveniência visíveis.
- [x] Fluxo `ThermalReading → Prediction → incidente → revisão humana → OS condicionada` demonstrável.
- [x] Origem sintética e limites da IA informados na interface.
- [x] A indisponibilidade da IA não deve produzir resultado analítico substituto.
- [x] O backlog possui fila PostgreSQL durável, lease/`SKIP LOCKED`, backoff, recuperação de `AI_FAILED` transitório, consumidor Vercel Queues e cron diário apenas reconciliador.

## Requisitos contratuais que bloqueiam a conclusão

A solução final não poderá ser declarada aderente enquanto faltar qualquer item abaixo:

- [x] Preservar a inspeção original com exatamente 19 achados: 2 “Prioridade 3 (P20)”, 10 “Prioridade 4 (P10)” e 7 “Prioridade 5 (P5)”.
- [x] Implementar a classificação empresarial P5–P100 sem confundi-la com risco da IA ou prioridade da OS.
- [!] Obter da empresa o significado oficial de P30, P50 e P100. O software reconhece os códigos, mas mantém ação/prazo bloqueados até a validação externa da Etapa 12.
- [x] Preservar os significados já fornecidos: P20 = intervir em até 30 dias; P10 = intervir em parada programada; P5 = intensificar monitoramento.
- [ ] Rastrear por TAG a inspeção, o termograma, a leitura, a recomendação, a inferência, a decisão, o incidente e a OS.
- [x] Receber e analisar telemetria continuamente por fila PostgreSQL + Vercel Queues, sem depender da única execução diária do cron.
- [ ] Suportar implantação segura junto a quadros energizados, sem alterar proteções nem causar interrupção não planejada.
- [ ] Validar o sistema e o modelo com dados reais antes de alegar eficácia industrial.
- [ ] Demonstrar expansão pela mesma arquitetura para autoclaves, estufas, câmaras frias, quadros e mais de 20 centrífugas.
- [ ] Tratar aquecimento por resistência elevada/conexão frouxa como modo provável relevante, sem declarar oxidação ou subdimensionamento como causa confirmada antes da inspeção humana.

## Etapa 9 — processo empresarial e telemetria — concluída em 09/09/2026

### 9.0 Prioridade empresarial e inspeção original

- [x] Criar enum/tabela de prioridade empresarial com P5, P10, P20, P30, P50 e P100.
- [x] Criar entidades de inspeção e achado histórico imutável, preservando separadamente o rótulo original e o código P.
- [x] Importar/reconciliar a inspeção original: 2×“Prioridade 3/P20”, 10×“Prioridade 4/P10” e 7×“Prioridade 5/P5”.
- [x] Manter o TP-039 como P20 histórico; o segundo P20 permanece identificado como mapeamento demonstrativo até a fonte oficial.
- [x] Versionar a política que relaciona evidência, recomendação e prioridade empresarial.
- [x] Configurar P20/P10/P5 com as ações informadas no desafio e bloquear P30/P50/P100 até validação oficial.
- [x] Copiar prioridade e versão da política para incidente, revisão, alerta, OS e relatório da OS.
- [x] Mostrar lado a lado prioridade histórica, recomendação atual da IA e decisão humana final.
- [x] Exigir justificativa auditável quando uma pessoa altera a prioridade recomendada; o diagnóstico da Prediction permanece imutável.

### 9.1 Contrato de telemetria

- [x] Definir payload versionado para leituras em lote, independente de fabricante, protocolo ou broker.
- [x] Autenticar cada dispositivo/gateway com credencial rotacionável e escopo mínimo.
- [x] Validar TAG/ponto, timestamp, sequência, unidade, qualidade, limites e tamanho do lote.
- [x] Garantir idempotência por dispositivo, sequência e identificador da leitura.
- [x] Persistir o lote e o trabalho de análise em armazenamento durável antes de responder sucesso.
- [x] Rejeitar cada item inválido com resultado explícito, sem leitura parcial silenciosa.

### 9.2 Dispositivos, segurança e rede instável

- [x] Implementar cadastro, ativação por primeira leitura válida, revogação, rotação de chave e auditoria de dispositivos.
- [x] Proteger contra replay e abuso com clock skew, sequência e rate limiting.
- [x] Atualizar `lastSeenAt` e estado online/offline sem tratar ausência de comunicação como normal.
- [x] Implementar buffer no gateway e reenvio idempotente após reconexão.
- [x] Definir retenção do log técnico, limite de payload e política de dados atrasados; evidências térmicas não são apagadas sem política empresarial.

### 9.3 Processamento contínuo e escalabilidade

- [x] Implementar fila PostgreSQL durável e consumidor Vercel Queues adequado ao ambiente serverless.
- [x] Reservar jobs com lock/lease e impedir processamento duplicado.
- [x] Aplicar retentativa com backoff e fila de erro recuperável.
- [x] Reprocessar automaticamente `AI_FAILED` transitório e medir idade do item mais antigo.
- [x] Dimensionar e testar o contrato de 55 leituras/minuto, equivalentes a 79.200 leituras/dia; o soak sustentado do deployment permanece na Etapa 11.
- [x] Usar o cron diário somente para reconciliação, retenção, varredura de órfãos e recuperação; ele não substitui o worker contínuo.
- [x] Expor métricas de recebidos, persistidos, analisados, falha, atraso, rejeição e duplicação.

### 9.4 Interface operacional

- [x] Mostrar estado do dispositivo, última comunicação, última leitura e idade da última inferência.
- [x] Distinguir claramente `PENDING_AI`, `ANALYZED`, `AI_FAILED`, offline e leitura vencida.
- [x] Manter o botão de sincronização apenas como solicitação extraordinária de reprocessamento; a operação normal continua automática.
- [x] Permitir filtrar por TAG, área, tipo de ativo, prioridade empresarial, risco atual e estado da análise.

### Saída da Etapa 9

- [x] Distribuição histórica 2 P3/P20, 10 P4/P10 e 7 P5/P5 validada no banco.
- [x] Política P5–P100 publicada e versionada como `DEMO_DRAFT`, com somente P5/P10/P20 validados pelo enunciado.
- [x] Testes de capacidade (79.200 leituras), reconexão e idempotência aprovados; o soak do backlog em produção permanece na Etapa 11.
- [x] Falhas transitórias se recuperam por Vercel Queues, backoff e reconciliação diária, sem comando manual no shell.

Evidências: `docs/telemetry.md`, `pnpm --filter web telemetry:capacity`, `pnpm --filter web stage9:verify`, 353 testes gerais + 3 testes PostgreSQL específicos e build de produção aprovados em 09/09/2026.

## Etapa 10 — termogramas, relatórios e feedback

### 10.0 Evidência termográfica

- [ ] Implementar upload/importação de termograma em armazenamento privado.
- [ ] Validar MIME, tamanho, extensão, autorização, checksum e metadados.
- [ ] Registrar câmera/origem, emissividade, distância, ambiente e ROI quando disponíveis.
- [ ] Vincular cada termograma a TAG/ponto, inspeção e leitura correspondente.
- [ ] Exibir termograma e série numérica na mesma linha do tempo.
- [ ] Definir retenção, exportação autorizada e exclusão auditada.
- [ ] Não tornar visão computacional avançada obrigatória nesta etapa; o modelo pode operar sobre dados térmicos estruturados.

### 10.1 Relatórios e decisão

- [ ] Criar relatório por TAG/ponto com histórico térmico, termogramas, inferências, decisões e manutenções.
- [ ] Criar consolidado dos 55 pontos com os 19 achados originais e o estado atual separados.
- [ ] Incluir prioridade histórica, recomendada e final, além da versão da política.
- [ ] Registrar confirmação, rejeição, inconclusão e solicitação de nova leitura com autoria e justificativa.
- [ ] Mostrar normalização pós-manutenção sem apagar a evidência anterior.

### Saída da Etapa 10

- [ ] Um auditor autorizado reconstrói o caminho completo de qualquer TAG.
- [ ] O relatório não apresenta dado sintético como observação industrial real.

## Etapa 11 — qualidade, segurança e demonstração

- [ ] Testar a taxonomia P5–P100 e a distribuição histórica 2/10/7.
- [ ] Testar acesso autorizado e negado a termogramas.
- [ ] Testar ingestão idempotente, replay, reconexão, fila durável, retry e recuperação de worker.
- [ ] Executar E2E `telemetria → IA → incidente → decisão humana → OS → pós-manutenção`.
- [ ] Executar E2E fail-closed com IA indisponível e comprovar preservação/reprocessamento dos dados.
- [ ] Executar teste de carga mínimo de 55 pontos/minuto por período suficiente para observar estabilidade.
- [ ] Validar navegação por teclado, responsividade e legibilidade das telas prioritárias.
- [ ] Remover/ocultar fluxos legados sem dependência ativa que confundam a apresentação termográfica.
- [ ] Garantir que segredos, respostas falsas, resultados analíticos semeados e fallback de demonstração não entram no build.

## Etapa 12 — piloto industrial e dados reais

- [ ] Obter inventário e documentação oficiais: TAGs, prioridades, termogramas, recomendações e intervenções.
- [ ] Validar com a empresa toda a escala P5–P100 e os prazos/ações associados.
- [ ] Selecionar piloto representativo com responsáveis de operação, elétrica, manutenção e segurança.
- [ ] Aprovar análise de risco, NR-10, procedimento de instalação, janela autorizada e rollback físico/lógico.
- [ ] Usar sensores e acessórios apropriados para proximidade de quadros energizados.
- [ ] Confirmar que software/sensor não altera nem substitui disjuntor, relé ou outra proteção.
- [ ] Instalar progressivamente e comprovar zero interrupção não planejada causada pela solução.
- [ ] Comparar sensor contínuo com câmera termográfica de referência.
- [ ] Medir disponibilidade, latência, cobertura, falso positivo, falso negativo e divergência por tipo de ativo.
- [ ] Medir separadamente a qualidade da identificação de modos de falha, com foco no padrão de resistência elevada em bornes/conexões.
- [ ] Registrar causa e ação reais após manutenção para construir dataset supervisionado.
- [ ] Definir horizonte preditivo e critérios mínimos com a manutenção.
- [ ] Promover modelo de dados reais somente se superar baseline/modelo anterior, com rollback disponível.
- [ ] Planejar expansão para todos os 55 pontos e para as mais de 20 centrífugas.

## Bloqueadores de produção e operação

- [ ] Trocar `AUTH_SECRET`, `AI_SERVICE_API_KEY`, `CRON_SECRET` e credenciais de dispositivos por valores fortes e únicos.
- [ ] Configurar `NEXTAUTH_URL`, URLs/bindings internos e CORS estritamente para os domínios implantados.
- [ ] Aplicar rate limiting no login, telemetria, upload e FastAPI.
- [ ] Validar tamanho máximo de payload/arquivo no servidor.
- [ ] Completar auditoria de criação/alteração de OS, incidentes, revisões, dispositivos, importações e termogramas.
- [ ] Configurar CI para lint, typecheck, testes web, testes FastAPI, migrations e verificação do modelo.
- [ ] Configurar logs estruturados, métricas, alertas de uptime, backlog e falha de inferência.
- [ ] Validar pooling do Prisma, backup/restore do banco, retenção e rollback de migrations.
- [ ] Documentar o procedimento Neon usado pelo projeto sem tratar `db push` como substituto informal de migration em produção.
- [ ] Executar `pnpm demo:verify` e o roteiro E2E antes de cada apresentação/deploy relevante.

## Itens retirados do caminho crítico

Os itens abaixo não devem ser implementados agora, salvo nova necessidade comprovada:

- Recalibrar a taxa sintética de falhas do dataset AI4I de 3,58% para 3,4%.
- Expandir telas/CSV com `airTemperature`, `processTemperature`, `toolWear`, `rotationalSpeed` ou `torque` do modelo mecânico legado.
- Evoluir o fluxo genérico `FailureEvent` mecânico ou retreino por falhas mecânicas como requisito do desafio térmico.
- Tornar MQTT obrigatório ou acoplar o domínio a um broker/fabricante específico.
- Implementar visão computacional avançada sobre qualquer formato de termograma no primeiro piloto.
- Implementar notificações externas antes de a empresa definir canal, responsável e escalonamento.
- Fazer cache, índices, agregações ou otimizações de bundle sem medição que demonstre gargalo.
- Polir módulos genéricos de PCM que não participem da cadeia térmica nem da demonstração.
- Retreinar ou promover modelos automaticamente sem validação humana e critérios comparativos.
- Permitir que a IA autorize manutenção, desligamento ou intervenção física.

## Definição de pronto

- [ ] Todos os critérios das Etapas 9–12 estão atendidos e verificados.
- [ ] A solução demonstra os 55 pontos, os 19 achados históricos (2 P3/P20, 10 P4/P10 e 7 P5/P5) e o caso de 75,6/40/35,6 sem confundir histórico com análise atual.
- [ ] A escala P5–P100, a rastreabilidade por TAG/termograma e o processo humano são auditáveis de ponta a ponta.
- [ ] O monitoramento é contínuo, recuperável e não depende do cron diário nem de comandos manuais.
- [ ] O piloto comprova segurança, zero interrupção não planejada e resultados medidos com dados reais.
- [ ] Limitações, riscos, origem dos dados e estágio do modelo permanecem explícitos.
