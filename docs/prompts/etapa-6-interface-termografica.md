# Prompt de implementação — Etapa 6

Implemente a Etapa 6 de `Adequaçoes.md` neste repositório. Leia as seções das Etapas 5 e 6 e os registros correspondentes de `docs/architecture.md`. As Etapas 1–5 estão estruturalmente concluídas; o modelo térmico real depende da Etapa 8. Execute este prompt, não apenas proponha um plano.

## Contrato obrigatório

- Preserve Next.js App Router, TypeScript, Prisma/PostgreSQL, policies, Server Actions e componentes existentes.
- Consuma somente leituras e evidências persistidas. Nunca importe o manifesto do cenário para o runtime, fabrique predições ou calcule severidade por temperatura, limites ou `initiallyAnomalous`.
- Use `aiCoreStateService.getState()` como fonte do estado da IA. Sem `READY`, bloqueie novas inferências/OS e apresente o estado explicitamente. Evidências anteriores podem ser consultadas e revisadas por humanos como histórico, conforme a exceção documentada na Etapa 5, sem apresentá-las como diagnóstico atual.
- Exija proveniência térmica válida, inferência concluída e correspondência com a leitura para apresentar uma Prediction. Uma leitura pendente não herda o estado normal de uma inferência antiga.
- Identifique dados sintéticos pela origem persistida; apresente `initiallyAnomalous` exclusivamente como fato da inspeção original.
- Não execute reset, seed, migrations destrutivas, treinamento, deploy ou integração de sensores. Não reutilize métricas do modelo mecânico.

## Implementação

1. Torne `/thermal-monitoring` a entrada autenticada. Inclua monitoramento, incidentes, painéis e dispositivos na navegação, inclusive mobile. Preserve consulta e execução de OS; retire a navegação analítica mecânica e redirecione suas telas para o fluxo térmico. Bloqueie a conversão legada de alertas em OS para evitar bypass da confirmação humana.
2. Implemente dashboard com total real de pontos ativos, contagens de risco válidas, ausência de comunicação, incidentes abertos, máximas observadas de temperatura/ΔT, tendência registrada, última leitura/inferência e fila `PENDING_AI`/`AI_FAILED`. Valores analíticos indisponíveis devem aparecer como indisponíveis, nunca zero fabricado.
3. Implemente filtros combináveis por texto/código, setor, equipamento, painel, componente, risco e conectividade; separe o histórico de anomalia do estado atual. Calcule conectividade somente a partir do cadastro/último contato e intervalo de amostragem, sem inferir defeito. Não trate ponto manual como sensor offline.
4. Implemente `/thermal-monitoring/points/[id]`: hierarquia, leitura atual e origem, série térmica e carga/corrente no mesmo intervalo, limites de engenharia identificados, histórico de predições com explicações, modo de falha, confiança, versão/checksum e IDs rastreáveis, incidentes/OS e configuração/calibração/dispositivos.
5. Implemente `/thermal-incidents` e `/thermal-incidents/[id]`: filtros, estado e severidade persistidos, pico/evolução, evidência de origem e mais recente, recomendação e linha do tempo com revisões, OS e pós-ação. Conecte os quatro tipos de decisão às actions da Etapa 5 e permita OS somente com confirmação humana válida, IA pronta, permissão e equipamento real. Mostre justificativas e IDs da predição revisada. Não invente normalização nem intervenção.
6. Reutilize os cadastros de painéis/dispositivos e disponibilize `/settings/thermal-risk` como acesso à configuração térmica existente. Acrescente links entre cadastro e monitoramento.
7. Inclua estados vazios, carregamento, erros, indisponibilidade, labels acessíveis, texto além de cores, feedback de envio e layout mobile.

## Verificação e entrega

- Teste as regras de apresentação com 55 pontos, filtros combinados, ausência de leitura, sensor offline, risco crítico com proveniência, leitura nova pendente e serviço indisponível. Fixtures somente em testes isolados.
- Teste bloqueios e decisões humanas usando testes unitários e a infraestrutura de integração existente apenas se houver banco de teste explicitamente isolado. Nunca aponte testes de escrita para o banco demonstrativo.
- Execute typecheck, lint e suíte unitária. Faça verificação pelo navegador se disponível, com dados reais, sem criar registros analíticos fictícios.
- Atualize documentação com o escopo efetivamente implementado, verificações executadas e pendências reais. Não marque validação dependente do modelo da Etapa 8 como concluída.

## Execução

Prompt consumido nesta sessão em 08/09/2026. O registro dos resultados fica em `docs/architecture.md`, na seção da Etapa 6.
