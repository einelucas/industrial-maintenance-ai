# Telemetria térmica — contrato da Etapa 9

## Endpoint

`POST /api/v1/telemetry/thermal-readings`

Cabeçalhos obrigatórios:

- `Authorization: Bearer <chave exibida no provisionamento>`
- `X-Device-Id: <UUID do dispositivo>`
- `Content-Type: application/json`

Exemplo:

```json
{
  "schemaVersion": "thermal-telemetry-v1",
  "readings": [
    {
      "sequence": 101,
      "thermalPointCode": "TP-039",
      "measuredAt": "2026-09-09T16:48:00.000Z",
      "temperatureMaxC": 75.6,
      "referenceTemperatureC": 40,
      "currentA": 27.4,
      "loadPercent": 86,
      "emissivity": 0.95,
      "signalQuality": 0.98
    }
  ]
}
```

O dispositivo nunca envia risco, severidade, causa, incidente ou prioridade. Campos desconhecidos são rejeitados. Cada item aceito cria de forma atômica uma `ThermalReading` e uma `InferenceRequest` durável. A resposta informa apenas recebimento, duplicação ou rejeição; a classificação continua exclusiva do núcleo de IA.

## Idempotência e reconexão

A chave idempotente é `deviceId + sequence`. Um gateway deve manter localmente as leituras não confirmadas e reenviá-las com a mesma sequência. Duplicatas retornam `DUPLICATE` e não geram nova leitura, inferência ou alerta. Leituras atrasadas dentro de `TELEMETRY_MAX_DELAY_DAYS` são aceitas.

## Segurança

A chave individual é mostrada somente ao provisionar/reprovisionar e apenas seu SHA-256 fica no banco. Revogação e manutenção bloqueiam ingestão. Falhas são auditadas sem gravar chave ou IP em texto puro. O limite padrão é 60 requisições por minuto por identidade de dispositivo/rede.

O log técnico de requisições possui retenção padrão de 90 dias, configurável por `TELEMETRY_AUDIT_RETENTION_DAYS` (mínimo de 30 dias), e é limpo apenas pela reconciliação diária. Leituras térmicas, inferências e evidências operacionais não são removidas por essa rotina: permanecem preservadas por TAG até existir uma política empresarial formal de retenção e exclusão auditada.

## Processamento contínuo

Cada requisição persiste leitura e job na fila PostgreSQL antes do `202 Accepted` e publica somente um gatilho idempotente no tópico `thermal-analysis` do Vercel Queues. O consumidor `api/queues/thermal-analysis` roda separado da resposta do dispositivo e usa lease, `SKIP LOCKED`, concorrência limitada e backoff exponencial. Quedas não perdem o job: o PostgreSQL continua como fonte de verdade, enquanto o Vercel Queues fornece entrega durável, retentativa e escala do consumidor. Em localhost, onde não há OIDC da Vercel, a rota usa o mesmo worker de forma limitada como fallback de desenvolvimento.

O cron diário não é o mecanismo de monitoramento. Ele apenas libera leases órfãos, reabre falhas recuperáveis e processa pendências remanescentes. Também existe o endpoint interno `POST /api/internal/thermal-worker`, protegido por `TELEMETRY_WORKER_SECRET`, como recuperação operacional adicional sem expor operações administrativas aos dispositivos.

No deploy, o projeto precisa estar com o preset **Services** e com Vercel Queues disponível para o projeto. O gatilho e o consumidor já estão declarados no `vercel.json`; as credenciais da fila são resolvidas pela identidade OIDC do ambiente Vercel, não por uma chave manual no `.env`.

## Gateway demonstrativo

```powershell
$env:TELEMETRY_BASE_URL="http://localhost:3000"
$env:TELEMETRY_DEVICE_ID="<uuid>"
$env:TELEMETRY_DEVICE_API_KEY="<chave>"
$env:TELEMETRY_POINT_CODE="TP-039"
pnpm --filter web telemetry:gateway
```

O simulador gera sequência contínua, dois ciclos de perda de rede a cada doze, reenvio em lote e pico de 75,6 °C. É apenas um adaptador de demonstração; HTTPS, MQTT, ESP32 ou uma câmera específica não fazem parte do domínio obrigatório.

## Verificação de capacidade

```powershell
pnpm --filter web telemetry:capacity
```

O verificador reproduz o contrato nominal de 55 pontos a uma leitura por minuto durante 24 horas: 79.200 leituras, divididas em lotes de no máximo 100 itens. Ele valida todos os itens e envelopes, serializa os payloads e informa latências p50/p95/máxima e o maior payload. O teste de integração `thermal-telemetry.integration.test.ts`, executado quando `TEST_DATABASE_URL` está configurada, complementa essa medição exercitando persistência atômica, fila durável, autenticação e reenvio idempotente no PostgreSQL real.
