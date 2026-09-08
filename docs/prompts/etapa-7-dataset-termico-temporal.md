# Prompt de implementação — Etapa 7

Implemente integralmente a Etapa 7 de `Adequaçoes.md`: dataset sintético temporal termográfico. Leia também as seções 10 e 11 da especificação detalhada no mesmo documento, o contrato de inferência e o cálculo de features da Etapa 5, e o registro da Etapa 6 em `docs/architecture.md`. Execute este prompt, não apenas proponha um plano.

## Objetivo e limites

Crie um pipeline reproduzível para gerar séries térmicas fisicamente relacionadas, construir janelas temporais compatíveis com o payload de inferência, separar treino/validação/teste sem vazamento, reservar a demonstração e produzir validações auditáveis. Os dados são sintéticos experimentais; nunca devem ser descritos como evidência de eficácia industrial.

- Não misture colunas, dataset, artefatos ou métricas do AI4I no pipeline térmico.
- Não treine nem promova o modelo operacional da Etapa 8. Avaliações simples nesta etapa servem somente para detectar vazamento e caracterizar o dataset.
- Não altere o schema, não execute migration/reset e não grave Prediction, incidente, alerta ou OS.
- Não consulte `ground truth` no FastAPI ou frontend. Rótulos pertencem apenas a `datasets/` e `training/`.
- Não aplique automaticamente o cenário reservado ao banco demonstrativo já populado. O carregador deve ser explícito, seguro, usar o service real de ingestão e ter dry-run como padrão.
- Preserve as mudanças já existentes das Etapas 6 e anteriores.

## Contrato do dataset

Documente em código e metadados nomes, tipos, unidades e nulabilidade. Use timestamps UTC, intervalo de 30 minutos, horizonte primário de 24 horas e secundário de 7 dias. Use seeds e períodos distintos para treino, validação, teste e demonstração. Inclua 55 identidades persistentes e distribuição pelos tipos de componente do domínio.

As séries brutas devem conter contexto físico e rótulos separados: identidade/hierarquia, temperatura máxima/média/ambiente/referência, ΔT, corrente, carga, emissividade, qualidade/estado de comunicação, estado de operação/manutenção, modo de falha, anomalia ativa, manutenção requerida, falha em 24 h e falha em 7 dias. Nenhum rótulo pode ser necessário para reconstruir uma feature de inferência.

Simule relações causais simplificadas: ciclo diário do ambiente, turnos, variação de carga, inércia térmica no acionamento/desligamento, baseline por componente, ruído e pequenas falhas de comunicação. Inclua conexão frouxa/resistência elevada, sobrecarga, desequilíbrio de fases/referência, contato degradado, ventilação insuficiente com efeito comum no painel, relé degradado, erro de sensor separado e recuperação pós-manutenção. Varie início, duração, intensidade, carga e ambiente por episódio; não replique uma linha crítica milhares de vezes.

## Separação e janelas

- Faça split cronológico e reserve painéis/pontos para avaliar generalização. Nenhuma identidade de demonstração pode aparecer nos splits de desenvolvimento.
- Calcule cada janela usando somente amostras com timestamp menor ou igual ao cutoff. Targets podem olhar para o futuro; features não.
- Reproduza os nomes e a semântica das features da Etapa 5 (`thermal-features-v1`), incluindo médias 5/15/60 min, máximos 1/6/24 h, tendência, persistência, baseline, carga/corrente e qualidade. Registre divergências inevitáveis no contrato.
- Remova janelas sem histórico suficiente do conjunto modelável e mantenha o teste final intocado.
- Salve hashes SHA-256 dos arquivos, contrato, seeds, períodos, grupos reservados, contagens e distribuição de classes num manifesto canônico.

## Cenário reservado GPMS

Gere separadamente 55 pontos e exatamente 19 com episódios anormais, com seeds e período distintos. Inclua TP-039 chegando uma única vez ao pico exato de 75,6 °C, referência 40,0 °C e ΔT 35,6 °C, além da queda após manutenção. Exporte leituras compatíveis com a ingestão da aplicação e manifesto de `ground truth` fora do runtime.

Implemente um carregador TypeScript chamado pelo wrapper Python. Ele deve:

1. validar hash/manifesto e a separação do treino;
2. converter apenas campos de medição, nunca rótulos;
3. chamar `thermalReadingService.ingestBatchByCode()` com origem `SIMULATOR`;
4. operar em dry-run por padrão;
5. exigir flags explícitas para escrita e para aceitar timestamps já presentes;
6. recusar duplicação e não executar backfill/inferência.

## Validação

Crie testes de reprodutibilidade, contrato, causalidade temporal, splits, 55/19, pico crítico, recuperação, classes, isolamento do ground truth e equivalência das features com casos de referência do TypeScript. Gere gráficos auditáveis de exemplos normais e de cada falha, relatório de correlações e distribuição. Compare regras simples com um baseline ML usando somente treino/validação e mostre que o target não é reconstruído perfeitamente; não use o teste final para escolha.

Execute geração e validações com o mesmo comando documentado. Execute pytest e as verificações TypeScript relevantes. Atualize `Adequaçoes.md`, `docs/architecture.md`, README e `.gitignore` com o resultado real, hashes e pendências. Só marque concluído o que foi efetivamente comprovado.

## Execução

Prompt consumido nesta sessão em 08/09/2026. O registro final deve ficar em `docs/architecture.md`, na seção da Etapa 7.
