// Flags de ambiente lidas uma vez, server-side. O simulador de dados
// sintéticos fica desabilitado por padrão para não aparecer na experiência
// normal de produção; a permissão de usuário continua obrigatória além
// desta flag (ver thermal-readings/simulator/page.tsx e as actions do
// simulador).
export const FEATURE_FLAGS = {
  thermalSimulatorEnabled: process.env.ENABLE_THERMAL_SIMULATOR === "true",
} as const;
