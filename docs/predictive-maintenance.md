# Fluxo de Manutenção Preditiva

```
SensorReading  →  Prediction  →  Alert  →  (decisão do planejador)  →  WorkOrder (PREDICTIVE)
```

## 1. SensorReading

Uma medição é registrada de duas formas:
- **Manual**: formulário na aba "Medições" da página do equipamento (`/equipments/[id]`).
- **Simulador**: botões "Gerar leitura Normal/Atenção/Crítica" na mesma aba — geram valores fictícios plausíveis para demonstrar o fluxo (`features/sensor-readings/services/sensor-simulator.service.ts`). Não simula física industrial real.

Campos são opcionais — nem todo equipamento tem todos os sensores disponíveis.

## 2. Prediction

Ao registrar uma leitura, `features/sensor-readings/services/sensor-reading.service.ts` chama `predictionService.runPredictionForReading()`, que:
1. Envia as features disponíveis ao FastAPI via `predictiveAiClient.predictFailure()`.
2. Persiste o resultado como uma nova `Prediction` — **nunca sobrescreve** a anterior, formando um histórico temporal por equipamento.
3. Se `riskLevel` for `MODERATE`, `HIGH` ou `CRITICAL`, cria um `Alert` (ver decisão documentada em `docs/architecture.md`).

Se o FastAPI estiver indisponível, a leitura permanece salva e um erro claro é mostrado na UI — nada é inventado.

## 3. Alert

Aparece em `/alerts`, com:
- **Reconhecer** — marca como `ACKNOWLEDGED` (o planejador está ciente, mas ainda não agiu).
- **Criar OS preditiva** — transforma o alerta em uma `WorkOrder` do tipo `PREDICTIVE`, com `sourcePredictionId` apontando para a `Prediction` de origem, e marca o `Alert` como `RESOLVED`.

**Nunca há criação automática de OS** — a transformação exige clique explícito do planejador (`features/alerts/services/alert.service.ts#convertToWorkOrder`).

## 4. WorkOrder (PREDICTIVE)

A partir daí, segue o fluxo normal de qualquer OS: planejamento, atribuição, execução, conclusão — com histórico completo em `WorkOrderHistory`.

## Faixas de risco

Centralizadas em `services/predictive-ai/app/ml/predictor.py` (`RISK_THRESHOLDS`):

| Probabilidade | Nível |
|---|---|
| 0.00 – 0.29 | LOW |
| 0.30 – 0.59 | MODERATE |
| 0.60 – 0.79 | HIGH |
| 0.80 – 1.00 | CRITICAL |

## Modelo de IA

- **Treino**: `services/predictive-ai/training/` — compara Logistic Regression, Random Forest e Gradient Boosting por F1-score (desempate por ROC-AUC); nunca por accuracy isolada.
- **Fallback de desenvolvimento**: `DemoPredictor` — heurística determinística, claramente marcada como `isDemoModel: true` na resposta da API e no `modelVersion` salvo na `Prediction` (sufixo `(demo)`). Nunca apresentado como Machine Learning real.
- **Modelo real**: `SklearnPredictor` carrega `models/model.joblib` + `models/metadata.json` automaticamente quando presentes — sem qualquer alteração nos endpoints ou no client Next.js.
