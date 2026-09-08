# Prompt de implementação — Etapa 8

Implemente integralmente a Etapa 8 de `Adequaçoes.md`: treinamento termográfico e integração obrigatória com o FastAPI. Leia também as seções 11 e 12 da especificação detalhada, o contrato/dataset da Etapa 7 e a cadeia `ThermalReading -> InferenceRequest -> Prediction -> ThermalIncident` da Etapa 5. Execute este prompt, não apenas descreva um plano.

## Resultado obrigatório

Treine e selecione um modelo térmico reproduzível, publique um artefato verificável e faça `/api/v1/thermal/health` e `/api/v1/thermal/predict` atenderem exatamente ao gateway Next.js existente. Uma inferência ML válida é condição necessária para qualquer score, piso de engenharia, incidente ou OS. Ausência, corrupção ou incompatibilidade do artefato deve deixar readiness indisponível e não pode acionar fallback por regras, resposta hardcoded, `DemoPredictor` ou `RULE_ONLY`.

Preserve as mudanças existentes. Não altere schema/migrations sem necessidade comprovada, não consulte rótulos do cenário reservado no runtime e não use o teste final para selecionar algoritmo, parâmetros ou thresholds.

## Treinamento e avaliação

- Crie `train_thermal_models.py` parametrizado por dataset, diretório de saída, target, seed, estágio e período.
- Compare Logistic Regression, Random Forest e Gradient Boosting supervisionados. Avalie Isolation Forest como detector complementar, sem permitir que ele opere sozinho.
- Selecione usando PR-AUC, ROC-AUC, F1, precision, recall, calibração e falsos alertas por ponto/dia; registre desempenho por tipo de componente e faixa de carga. Accuracy isolada nunca decide.
- Faça seleção e calibração somente com treino/validação. Abra o teste final uma única vez depois de congelar o vencedor e os thresholds.
- Produza probabilidades calibradas quando aplicável e um classificador separado de modo de falha. O classificador de causa serve à revisão humana e deve informar confiança.
- Persista um único bundle `thermal_model.joblib` contendo preprocessamento, modelo supervisionado obrigatório, detector complementar quando útil, classificador de causa, lista/ordem de features e thresholds de score.
- Crie `validate_model_artifact.py` e testes de corrupção, ausência, feature version, estágio, checksum, colunas e inferência determinística.

## Metadados e distribuição

Substitua os metadados mecânicos ativos por metadados térmicos versionados, mantendo qualquer histórico antigo apenas como arquivo inativo. Registre no mínimo:

- versão, estágio `SYNTHETIC_EXPERIMENTAL` e `isSyntheticModel: true`;
- algoritmo, transformações, features, target e horizonte;
- hashes distintos de treino e cenário reservado;
- períodos, seed, métricas de validação/teste, métricas por componente/faixa de carga, falsos alertas por ponto/dia e calibração;
- thresholds escolhidos, checksum SHA-256 do `.joblib`, versão de contrato/features, limitações e política de geração durante build controlado.

O artefato deve ser recuperável em instalação limpa por um comando documentado e verificável antes do processo ficar ready. Não dependa de Git LFS ou serviço externo nesta etapa.

## FastAPI térmico fail-closed

- Crie schemas Pydantic estritos que espelhem o request/response Zod existente, com aliases camelCase e rejeição de campos extras.
- Crie `ThermalMlPredictor` que carregue e valide bundle + metadados + checksum antes de aceitar inferência.
- Exponha `GET /api/v1/thermal/health` sem segredo, caminho local ou stack trace. Retorne `predictorType: thermal`, versão, estágio, origem sintética, checksum e `ready/modelLoaded` verdadeiros somente quando tudo for válido.
- Exponha `POST /api/v1/thermal/predict`, protegido por `X-API-Key`. Valide `thermalPointId`, `thermalReadingId`, `inferenceRequestId`, `featureVersion`, leitura, janelas, baseline, thresholds e qualidade.
- Recuse dados insuficientes e feature version incompatível. Não invente imputação fora do pipeline salvo no bundle.
- Retorne `modelScore`, `riskScore`, `riskLevel`, confiança, causa provável, confiança da causa, explicações, ação recomendada, versão, checksum, estágio e os IDs da requisição.
- O piso de engenharia pode elevar o `riskScore` somente depois de `predict_proba` válido. Registre `modelScore` separadamente.
- Remova o `DemoPredictor` do caminho ativo e desative o endpoint mecânico legado `/predict` com resposta clara de indisponibilidade; não ofereça predictor substituto.
- Inicialização da aplicação pode continuar disponível para expor health degradado, mas o componente térmico deve falhar fechado e nunca responder uma predição sem artefato válido.

## Integração Next.js

Reutilize o gateway, orquestrador, fila idempotente e persistência já implementados. Ajuste somente incompatibilidades reais de contrato. Garanta que:

- health exija tipo térmico, estágio permitido, artefato carregado e checksum válido;
- request envie leitura atual, janela, baseline, thresholds e qualidade reais;
- resposta Zod permaneça estrita e seja persistida com snapshot, `inferenceId`, `inferenceRequestId`, feature version, versão/checksum/estágio, scores, explicações e causa;
- falha mantenha a leitura `PENDING_AI` ou `AI_FAILED`, sem Prediction substituta;
- retry/backfill permaneça idempotente;
- interface identifique `SYNTHETIC_EXPERIMENTAL`.

## Verificação

Teste endpoint normal, caso crítico 75,6/40/35,6, schema 422, autenticação, dados insuficientes, feature version incompatível, explicações, causa, checksum e determinismo. Prove que o piso crítico só ocorre após score ML válido. Renomeie temporariamente ou injete caminho inválido em teste para provar que a remoção/corrupção do artefato reprova readiness e bloqueia predict.

Execute pipeline de treinamento duas vezes e compare checksums. Rode pytest, testes TypeScript, typecheck e lint. Valide o gateway contra um FastAPI real local. Processe o cenário reservado pelo fluxo real somente depois dessas validações; não leia `ground truth` no runtime e não grave resultados analíticos por insert direto. Se o banco compartilhado impedir uma execução segura, use integração isolada e documente precisamente a pendência em vez de alegar execução.

Atualize `Adequaçoes.md`, `README.md`, `docs/architecture.md`, arquivos `.env.example` e documentação de operação. Só marque comprovado o que foi efetivamente executado.

## Execução

Prompt consumido nesta sessão em 08/09/2026. O registro final deve ficar em `docs/architecture.md`, na seção da Etapa 8.
