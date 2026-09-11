export const GPMS_SCOPE = {
  program: "GPMS 2026",
  title: "Manutenção Preditiva",
  industry: "Indústria de alimentos para animais",
  inspectedPoints: 55,
  historicalAnomalies: 19,
  criticalTemperatureC: 75.6,
  criticalReferenceTemperatureC: 40,
  criticalDeltaTC: 35.6,
  minimumCentrifuges: 20,
  objective:
    "Reduzir o intervalo entre o surgimento de uma anomalia térmica e a ação de manutenção.",
} as const;
export const GPMS_ORIGINAL_CLASSIFICATIONS = [
  {
    sourceLabel: "Prioridade 3",
    companyPriority: "P20",
    expectedCount: 2,
    action: "Intervir em até 30 dias",
  },
  {
    sourceLabel: "Prioridade 4",
    companyPriority: "P10",
    expectedCount: 10,
    action: "Intervir em parada programada",
  },
  {
    sourceLabel: "Prioridade 5",
    companyPriority: "P5",
    expectedCount: 7,
    action: "Intensificar monitoramento",
  },
] as const;

export const GPMS_EXPECTED_ORIGINAL_DISTRIBUTION = {
  P5: 7,
  P10: 10,
  P20: 2,
  P30: 0,
  P50: 0,
  P100: 0,
} as const;
