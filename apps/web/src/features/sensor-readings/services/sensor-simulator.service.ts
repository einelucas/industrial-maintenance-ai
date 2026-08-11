import type { SimulatorProfile } from "@/features/sensor-readings/schemas/sensor-reading.schema";

/**
 * Gera leituras fictícias para demonstrar o fluxo da aplicação (seção 35).
 * Não simula física industrial real — apenas três perfis (NORMAL, ATTENTION,
 * CRITICAL) com faixas de valores plausíveis.
 */

type Range = readonly [number, number];

interface ProfileRanges {
  temperature: Range;
  vibration: Range;
  pressure: Range;
  rpm: Range;
  current: Range;
  torque: Range;
  operatingHours: Range;
  airTemperature: Range;
  processTemperature: Range;
  rotationalSpeed: Range;
  toolWear: Range;
}

const RANGES: Record<SimulatorProfile, ProfileRanges> = {
  NORMAL: {
    temperature: [45, 65],
    vibration: [1, 3],
    pressure: [3, 6],
    rpm: [1400, 1700],
    current: [10, 15],
    torque: [20, 40],
    operatingHours: [500, 2500],
    airTemperature: [20, 26],
    processTemperature: [30, 38],
    rotationalSpeed: [1450, 1650],
    toolWear: [0, 80],
  },
  ATTENTION: {
    temperature: [65, 78],
    vibration: [3, 5],
    pressure: [6, 8],
    rpm: [1700, 1900],
    current: [15, 20],
    torque: [40, 55],
    operatingHours: [2500, 4000],
    airTemperature: [26, 32],
    processTemperature: [36, 44],
    rotationalSpeed: [1300, 1450],
    toolWear: [80, 180],
  },
  CRITICAL: {
    temperature: [78, 95],
    vibration: [5, 9],
    pressure: [8, 12],
    rpm: [1900, 2200],
    current: [20, 28],
    torque: [55, 75],
    operatingHours: [4000, 6000],
    airTemperature: [32, 40],
    processTemperature: [38, 46],
    rotationalSpeed: [1100, 1300],
    toolWear: [180, 250],
  },
};

function rand([min, max]: Range): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

export function simulateReading(profile: SimulatorProfile) {
  const r = RANGES[profile];
  return {
    temperature: rand(r.temperature),
    vibration: rand(r.vibration),
    pressure: rand(r.pressure),
    rpm: rand(r.rpm),
    current: rand(r.current),
    torque: rand(r.torque),
    operatingHours: rand(r.operatingHours),
    airTemperature: rand(r.airTemperature),
    processTemperature: rand(r.processTemperature),
    rotationalSpeed: rand(r.rotationalSpeed),
    toolWear: rand(r.toolWear),
  };
}
