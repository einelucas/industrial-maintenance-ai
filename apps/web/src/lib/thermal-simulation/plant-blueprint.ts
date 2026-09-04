import type { ElectricalComponentType, EquipmentCriticality, PanelType, ThermalCause } from "@prisma/client";
import { createRng, hashSeed, shuffle } from "./rng";

// Estrutura determinística da planta demonstrativa GPMS 2026 (indústria de pet food:
// autoclaves, estufas, câmaras frias, mais de 20 centrífugas). Nomes/códigos são
// neutros de demonstração — não representam a empresa real do desafio.
//
// Exatamente 55 ThermalPoint são gerados; exatamente 19 são marcados
// `initiallyAnomalous` (fato histórico da inspeção original, nunca usado como
// severidade atual). Um deles é o caso crítico oficial (75,6 °C / 40,0 °C / ΔT 35,6 °C).

export const SECTOR_NAMES = {
  ESTERILIZACAO: "Esterilização",
  SECAGEM: "Secagem",
  CAMARA_FRIA: "Câmara Fria",
  CENTRIFUGACAO: "Centrifugação",
  UTILIDADES: "Utilidades",
} as const;

interface EquipmentGroupBlueprint {
  category: string;
  namePrefix: string;
  tagPrefix: string;
  count: number;
  sector: string;
  criticality: EquipmentCriticality;
  panelType: PanelType;
  componentTypesPerPoint: ElectricalComponentType[];
  ratedCurrent: number;
  /** Elevação (°C) de um componente saudável acima da temperatura ambiente, sob carga nominal. */
  componentBaselineRiseC: number;
}

const EQUIPMENT_GROUPS: EquipmentGroupBlueprint[] = [
  {
    category: "AUTOCLAVE",
    namePrefix: "Autoclave",
    tagPrefix: "AUT",
    count: 4,
    sector: SECTOR_NAMES.ESTERILIZACAO,
    criticality: "HIGH",
    panelType: "MCC",
    componentTypesPerPoint: ["CIRCUIT_BREAKER", "CONTACTOR", "THERMAL_RELAY"],
    ratedCurrent: 63,
    componentBaselineRiseC: 14,
  },
  {
    category: "ESTUFA",
    namePrefix: "Estufa de Secagem",
    tagPrefix: "EST",
    count: 4,
    sector: SECTOR_NAMES.SECAGEM,
    criticality: "MEDIUM",
    panelType: "CONTROL",
    componentTypesPerPoint: ["CONTACTOR", "THERMAL_RELAY"],
    ratedCurrent: 40,
    componentBaselineRiseC: 12,
  },
  {
    category: "CAMARA_FRIA",
    namePrefix: "Câmara Fria",
    tagPrefix: "CFR",
    count: 4,
    sector: SECTOR_NAMES.CAMARA_FRIA,
    criticality: "MEDIUM",
    panelType: "CONTROL",
    componentTypesPerPoint: ["CONTACTOR", "THERMAL_RELAY"],
    ratedCurrent: 32,
    componentBaselineRiseC: 10,
  },
  {
    category: "CENTRIFUGA",
    namePrefix: "Centrífuga",
    tagPrefix: "CTF",
    count: 21,
    sector: SECTOR_NAMES.CENTRIFUGACAO,
    criticality: "MEDIUM",
    panelType: "MCC",
    componentTypesPerPoint: ["THERMAL_RELAY"],
    ratedCurrent: 32,
    componentBaselineRiseC: 11,
  },
];

const UTILITIES_PANEL = {
  sector: SECTOR_NAMES.UTILIDADES,
  panelTag: "PNL-UTIL-GERAL-01",
  panelName: "Painel Geral de Distribuição — Utilidades",
  panelType: "DISTRIBUTION" as PanelType,
  points: [
    { componentType: "CIRCUIT_BREAKER" as ElectricalComponentType, ratedCurrent: 250, baselineRiseC: 9 },
    { componentType: "CIRCUIT_BREAKER" as ElectricalComponentType, ratedCurrent: 250, baselineRiseC: 9 },
    { componentType: "BUSBAR" as ElectricalComponentType, ratedCurrent: 400, baselineRiseC: 8 },
    { componentType: "BUSBAR" as ElectricalComponentType, ratedCurrent: 400, baselineRiseC: 8 },
    { componentType: "TERMINAL" as ElectricalComponentType, ratedCurrent: 100, baselineRiseC: 7 },
    { componentType: "TERMINAL" as ElectricalComponentType, ratedCurrent: 100, baselineRiseC: 7 },
  ],
};

const ANOMALY_CAUSES: ThermalCause[] = [
  "LOOSE_CONNECTION",
  "CONTACT_RESISTANCE",
  "OVERLOAD",
  "PHASE_IMBALANCE",
  "DEGRADED_CONTACT",
  "INSUFFICIENT_VENTILATION",
  "THERMAL_RELAY_DEGRADATION",
];

export interface EquipmentBlueprint {
  tag: string;
  name: string;
  category: string;
  criticality: EquipmentCriticality;
  sector: string;
}

export interface PanelBlueprint {
  tag: string;
  name: string;
  panelType: PanelType;
  sector: string;
  equipmentTag?: string;
}

export interface ComponentBlueprint {
  tag: string;
  name: string;
  componentType: ElectricalComponentType;
  panelTag: string;
  ratedCurrent: number;
}

export interface PointBlueprint {
  code: string;
  name: string;
  componentTag: string;
  ratedCurrent: number;
  componentBaselineRiseC: number;
  referenceTemperatureC: number;
  absoluteLimitC: number;
  deltaTAttentionC: number;
  deltaTHighC: number;
  deltaTCriticalC: number;
  initiallyAnomalous: boolean;
  cause: ThermalCause;
  isOfficialCriticalCase: boolean;
}

export interface PlantBlueprint {
  identitySeed: number;
  sectors: string[];
  equipments: EquipmentBlueprint[];
  panels: PanelBlueprint[];
  components: ComponentBlueprint[];
  points: PointBlueprint[];
  officialCriticalPointCode: string;
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/**
 * Constrói a hierarquia física completa da planta demonstrativa de forma
 * puramente determinística a partir de `identitySeed`. Nenhuma chamada de
 * I/O, nenhum `Date.now()`, nenhum `Math.random()`.
 */
export function buildPlantBlueprint(identitySeed: number): PlantBlueprint {
  const sectors = new Set<string>();
  const equipments: EquipmentBlueprint[] = [];
  const panels: PanelBlueprint[] = [];
  const components: ComponentBlueprint[] = [];

  interface RawPoint {
    componentTag: string;
    ratedCurrent: number;
    componentBaselineRiseC: number;
  }
  const rawPoints: RawPoint[] = [];

  for (const group of EQUIPMENT_GROUPS) {
    sectors.add(group.sector);
    for (let i = 1; i <= group.count; i++) {
      const unitTag = `${group.tagPrefix}-${pad3(i)}`;
      const equipmentTag = `EQ-${unitTag}`;
      equipments.push({
        tag: equipmentTag,
        name: `${group.namePrefix} ${pad3(i)}`,
        category: group.category,
        criticality: group.criticality,
        sector: group.sector,
      });

      const panelTag = `PNL-${unitTag}`;
      panels.push({
        tag: panelTag,
        name: `Painel — ${group.namePrefix} ${pad3(i)}`,
        panelType: group.panelType,
        sector: group.sector,
        equipmentTag,
      });

      group.componentTypesPerPoint.forEach((componentType, componentIndex) => {
        const componentTag = `CMP-${unitTag}-${componentIndex + 1}`;
        components.push({
          tag: componentTag,
          name: `${componentType} — ${group.namePrefix} ${pad3(i)}`,
          componentType,
          panelTag,
          ratedCurrent: group.ratedCurrent,
        });
        rawPoints.push({
          componentTag,
          ratedCurrent: group.ratedCurrent,
          componentBaselineRiseC: group.componentBaselineRiseC,
        });
      });
    }
  }

  // Painel geral de distribuição — vinculado apenas ao setor Utilidades, sem equipamento.
  sectors.add(UTILITIES_PANEL.sector);
  panels.push({
    tag: UTILITIES_PANEL.panelTag,
    name: UTILITIES_PANEL.panelName,
    panelType: UTILITIES_PANEL.panelType,
    sector: UTILITIES_PANEL.sector,
  });
  UTILITIES_PANEL.points.forEach((point, index) => {
    const componentTag = `CMP-UTIL-${index + 1}`;
    components.push({
      tag: componentTag,
      name: `${point.componentType} — Distribuição Geral ${index + 1}`,
      componentType: point.componentType,
      panelTag: UTILITIES_PANEL.panelTag,
      ratedCurrent: point.ratedCurrent,
    });
    rawPoints.push({
      componentTag,
      ratedCurrent: point.ratedCurrent,
      componentBaselineRiseC: point.baselineRiseC,
    });
  });

  if (rawPoints.length !== 55) {
    throw new Error(`Blueprint inconsistente: esperados 55 pontos, gerados ${rawPoints.length}.`);
  }

  // Caso crítico oficial: fixo estruturalmente (não depende de RNG) — o relé
  // térmico da 11ª centrífuga, coerente com "contatores e relés térmicos" do
  // desafio. Sempre existe porque CENTRIFUGA.count = 21 e pointsPerUnit = 1.
  const officialCriticalComponentTag = "CMP-CTF-011-1";
  const officialCriticalPointIndex = rawPoints.findIndex((p) => p.componentTag === officialCriticalComponentTag);
  if (officialCriticalPointIndex === -1) {
    throw new Error("Blueprint inconsistente: componente do caso crítico oficial não encontrado.");
  }

  const identityRng = createRng(identitySeed);
  const allIndexes = rawPoints.map((_, index) => index);
  const otherIndexes = allIndexes.filter((index) => index !== officialCriticalPointIndex);
  const shuffledOthers = shuffle(otherIndexes, identityRng);
  const anomalousIndexes = new Set<number>([officialCriticalPointIndex, ...shuffledOthers.slice(0, 18)]);

  if (anomalousIndexes.size !== 19) {
    throw new Error(`Blueprint inconsistente: esperados 19 pontos anômalos, obtidos ${anomalousIndexes.size}.`);
  }

  const points: PointBlueprint[] = rawPoints.map((raw, index) => {
    const code = `TP-${pad3(index + 1)}`;
    const isAnomalous = anomalousIndexes.has(index);
    const isCritical = index === officialCriticalPointIndex;

    const causeRng = createRng(hashSeed(identitySeed, `${code}-cause`));
    const cause: ThermalCause = isCritical
      ? "LOOSE_CONNECTION"
      : isAnomalous
        ? ANOMALY_CAUSES[Math.floor(causeRng() * ANOMALY_CAUSES.length)]!
        : "NOT_CONFIRMED";

    // Referência fixa por ponto (não varia por leitura): valor plausível de
    // comparação para um componente saudável equivalente. O ponto crítico usa
    // exatamente 40,0 °C, o valor oficial do desafio GPMS 2026.
    const refRng = createRng(hashSeed(identitySeed, `${code}-reference`));
    const referenceTemperatureC = isCritical ? 40.0 : Math.round((34 + refRng() * 10) * 10) / 10;

    return {
      code,
      name: `Ponto termográfico ${code}`,
      componentTag: raw.componentTag,
      ratedCurrent: raw.ratedCurrent,
      componentBaselineRiseC: raw.componentBaselineRiseC,
      referenceTemperatureC,
      absoluteLimitC: 90,
      deltaTAttentionC: 10,
      deltaTHighC: 20,
      deltaTCriticalC: 30,
      initiallyAnomalous: isAnomalous,
      cause,
      isOfficialCriticalCase: isCritical,
    };
  });

  return {
    identitySeed,
    sectors: [...sectors],
    equipments,
    panels,
    components,
    points,
    officialCriticalPointCode: points.find((p) => p.isOfficialCriticalCase)!.code,
  };
}
