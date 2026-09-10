/**
 * Gateway demonstrativo independente de fabricante (Etapa 9).
 *
 * Produz somente medições físicas. Nunca envia risco, severidade, causa ou
 * diagnóstico. Durante a perda de rede simulada mantém um buffer local em
 * memória e o reenvia em lote, com a mesma sequência, na reconexão.
 */

const baseUrl = process.env.TELEMETRY_BASE_URL ?? "http://localhost:3000";
const deviceId = process.env.TELEMETRY_DEVICE_ID;
const apiKey = process.env.TELEMETRY_DEVICE_API_KEY;
const pointCode = process.env.TELEMETRY_POINT_CODE;
const intervalMs = Math.max(250, Number(process.env.TELEMETRY_SIM_INTERVAL_MS) || 1_000);
const maxCycles = Math.max(0, Number(process.env.TELEMETRY_SIM_MAX_CYCLES) || 60);

if (!deviceId || !apiKey || !pointCode) {
  throw new Error("Defina TELEMETRY_DEVICE_ID, TELEMETRY_DEVICE_API_KEY e TELEMETRY_POINT_CODE.");
}

interface BufferedReading {
  sequence: number;
  thermalPointCode: string;
  measuredAt: string;
  temperatureMaxC: number;
  temperatureAverageC: number;
  ambientTemperatureC: number;
  referenceTemperatureC: number;
  currentA: number;
  loadPercent: number;
  emissivity: number;
  signalQuality: number;
}

const buffer: BufferedReading[] = [];
let sequence = Math.floor(Date.now() / 1000);

function makeReading(cycle: number): BufferedReading {
  const criticalPeak = cycle > 0 && cycle % 20 === 0;
  const load = 65 + Math.sin(cycle / 4) * 20;
  const reference = 40;
  const temperature = criticalPeak ? 75.6 : 43 + load * 0.08 + Math.sin(cycle / 3);
  return {
    sequence: sequence++,
    thermalPointCode: pointCode!,
    measuredAt: new Date().toISOString(),
    temperatureMaxC: Number(temperature.toFixed(1)),
    temperatureAverageC: Number((temperature - 2.5).toFixed(1)),
    ambientTemperatureC: 27,
    referenceTemperatureC: reference,
    currentA: Number((10 + load * 0.2).toFixed(1)),
    loadPercent: Number(load.toFixed(1)),
    emissivity: 0.95,
    signalQuality: 0.98,
  };
}

async function flush() {
  if (!buffer.length) return;
  const batch = buffer.slice(0, 100);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/telemetry/thermal-readings`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "x-device-id": deviceId!,
      "content-type": "application/json",
    },
    body: JSON.stringify({ schemaVersion: "thermal-telemetry-v1", readings: batch }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Telemetria recusada (${response.status}): ${JSON.stringify(payload)}`);
  buffer.splice(0, batch.length);
  process.stdout.write(`${new Date().toISOString()} lote=${batch.length} resposta=${JSON.stringify(payload)}\n`);
}

async function main() {
  for (let cycle = 1; maxCycles === 0 || cycle <= maxCycles; cycle++) {
    buffer.push(makeReading(cycle));
    const simulatedNetworkLoss = cycle % 12 === 10 || cycle % 12 === 11;
    if (simulatedNetworkLoss) {
      process.stdout.write(`${new Date().toISOString()} rede_indisponivel buffer=${buffer.length}\n`);
    } else {
      try {
        await flush();
      } catch (error) {
        process.stderr.write(`${new Date().toISOString()} falha_envio buffer_preservado=${buffer.length} erro=${(error as Error).message}\n`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  await flush();
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
  process.exitCode = 1;
});
