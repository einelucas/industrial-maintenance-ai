"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ThermalChartReading {
  id: string; timestamp: number; temperatureMaxC: number; referenceTemperatureC: number | null;
  deltaTC: number | null; currentA: number | null; loadPercent: number | null;
}

const formatTime = (value: number) => new Date(value).toLocaleString("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

export function ThermalHistoryChart({ readings, absoluteLimitC }: { readings: ThermalChartReading[]; absoluteLimitC: number }) {
  if (!readings.length) return <p className="py-8 text-center text-muted-foreground">Nenhuma leitura disponível para o gráfico.</p>;
  return <div className="space-y-5">
    <div className="h-72 w-full" role="img" aria-label="Evolução de temperatura, referência e delta T. Valores também disponíveis na tabela de leituras.">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={readings} margin={{ top: 20, right: 20, bottom: 5, left: 0 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} minTickGap={60} tickFormatter={formatTime} tick={{ fontSize: 10 }} /><YAxis unit=" °C" width={65} />
        <Tooltip labelFormatter={(value) => formatTime(Number(value))} /><Legend /><ReferenceLine y={absoluteLimitC} stroke="#dc2626" strokeDasharray="6 4" label={{ value: "Limite de engenharia", position: "insideTopRight", fontSize: 11 }} ifOverflow="extendDomain" />
        <Line name="Temperatura (°C)" dataKey="temperatureMaxC" stroke="#dc2626" dot={false} isAnimationActive={false} />
        <Line name="Referência (°C)" dataKey="referenceTemperatureC" stroke="#2563eb" strokeDasharray="6 3" dot={false} isAnimationActive={false} />
        <Line name="ΔT (°C)" dataKey="deltaTC" stroke="#7c3aed" strokeDasharray="2 3" dot={false} isAnimationActive={false} />
      </LineChart></ResponsiveContainer>
    </div>
    <div className="h-60 w-full" role="img" aria-label="Corrente e carga no mesmo intervalo das temperaturas, com escalas independentes.">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={readings} margin={{ top: 10, right: 15, bottom: 5, left: 0 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} minTickGap={60} tickFormatter={formatTime} tick={{ fontSize: 10 }} /><YAxis yAxisId="current" unit=" A" width={65} /><YAxis yAxisId="load" orientation="right" unit="%" />
        <Tooltip labelFormatter={(value) => formatTime(Number(value))} /><Legend /><Line yAxisId="current" name="Corrente (A)" dataKey="currentA" stroke="#0891b2" dot={false} isAnimationActive={false} /><Line yAxisId="load" name="Carga (%)" dataKey="loadPercent" stroke="#7c3aed" strokeDasharray="5 3" dot={false} isAnimationActive={false} />
      </LineChart></ResponsiveContainer>
    </div>
    <p className="text-xs text-muted-foreground">O eixo do tempo é proporcional: intervalos sem medições aparecem como lacunas. Limites são contexto de engenharia e não produzem diagnóstico.</p>
  </div>;
}
