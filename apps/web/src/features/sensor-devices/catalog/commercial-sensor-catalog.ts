import type { ElectricalComponentType } from "@prisma/client";

export interface CommercialSensorProfile {
  id: "powerlogic-thermal-tag-spth150s" | "powerlogic-th110";
  manufacturer: "Schneider Electric";
  model: string;
  commercialReference: string;
  firmwareVersion: string;
  sensorType: string;
  measurement: string;
  communication: string;
  gateway: string;
  gatewayMinimumFirmware: string;
  temperatureRange: string;
  accuracy: string;
  power: string;
  application: string;
  integration: string;
  officialSources: ReadonlyArray<{ label: string; url: string }>;
}

const PANEL_SERVER_GUIDE_URL =
  "https://productinfo.se.com/ecostruxurepanelserverguide/doca0172-ecostruxure-panel-server-user-guide/Portuguese/DOCA0172%20EcoStruxure%20Panel%20Server%20Universal%20User%20Guide_pt_0000812846.xml/$/TPC_PanelServerTechnicalCharacteris-3453057E";
const PANEL_SERVER_RELEASE_NOTES_URL =
  "https://productinfo.se.com/ecostruxurepanelserverrn/doca0178-ecostruxure-panel-server-release-notes/Portuguese/DOCA0178%20EcoStruxure%20Panel%20Server%20Release%20Notes_pt_0000853254.xml/$/RN_EcoStruxurePanelServerPAS800_Wireless_Devices_pt_0000935611";
const PANEL_SERVER_SYSTEM_URL =
  "https://productinfo.se.com/ecostruxurepanelserverguide/doca0172-ecostruxure-panel-server-user-guide/English/DOCA0172%20EcoStruxure%20Panel%20Server%20Universal%20User%20Guide_0000492433.xml/$/TPC_PanelServerArchitecture-3452D5CF";

/**
 * Catálogo de referências comerciais pesquisadas em documentação oficial.
 *
 * Estes dados descrevem modelos existentes no mercado; não comprovam compra,
 * instalação ou comissionamento na planta. No seed demonstrativo, serial,
 * estado e telemetria continuam explicitamente simulados.
 */
export const COMMERCIAL_SENSOR_PROFILES = {
  POWERLOGIC_THERMAL_TAG_SPTH150S: {
    id: "powerlogic-thermal-tag-spth150s",
    manufacturer: "Schneider Electric",
    model: "PowerLogic Thermal Tag SPTH150S",
    commercialReference: "SPTH150S",
    firmwareVersion: "Ref. 001.004.001 (simulado)",
    sensorType: "Sensor térmico sem fio autoalimentado",
    measurement: "Temperatura de conexão elétrica",
    communication: "IEEE 802.15.4 via EcoStruxure Panel Server",
    gateway: "EcoStruxure Panel Server PAS800 (gateway A ou B)",
    gatewayMinimumFirmware: "002.003.000",
    temperatureRange: "Confirmar na ficha técnica do lote adquirido",
    accuracy: "Confirmar na ficha técnica do lote adquirido",
    power: "Autoalimentado",
    application: "Referência para disjuntores, contatores e relés térmicos de painéis de equipamentos.",
    integration:
      "Sensor → Panel Server PAS800 → conector edge/Modbus TCP ou HTTPS → API de telemetria do MegaTherm AI.",
    officialSources: [
      { label: "Compatibilidade e firmware — Schneider Electric", url: PANEL_SERVER_RELEASE_NOTES_URL },
      { label: "Comunicação do Panel Server — Schneider Electric", url: PANEL_SERVER_GUIDE_URL },
      { label: "Capacidade do sistema — Schneider Electric", url: PANEL_SERVER_SYSTEM_URL },
    ],
  },
  POWERLOGIC_TH110: {
    id: "powerlogic-th110",
    manufacturer: "Schneider Electric",
    model: "PowerLogic TH110 (EMS59440)",
    commercialReference: "EMS59440",
    firmwareVersion: "Ref. 002.000.000 EFR32 (simulado)",
    sensorType: "Sensor térmico de contato sem fio e sem bateria",
    measurement: "Temperatura de conexão, cabo ou barramento energizado",
    communication: "Zigbee Green Power, 2,4 GHz (IEEE 802.15.4)",
    gateway: "EcoStruxure Panel Server PAS800 (gateway B)",
    gatewayMinimumFirmware: "002.006.000 para hardware EFR32",
    temperatureRange: "−25 a +125 °C a 40 °C ambiente; 150 °C máximo por tempo limitado",
    accuracy: "±1 °C entre −25 e +80 °C; ±2 °C fora dessa faixa",
    power: "Energy harvesting do campo eletromagnético; sem bateria",
    application: "Referência para barramentos, terminais e disjuntores de 100–400 A do painel de utilidades.",
    integration:
      "Sensor → Panel Server PAS800 → conector edge/Modbus TCP ou HTTPS → API de telemetria do MegaTherm AI.",
    officialSources: [
      {
        label: "Manual do PowerLogic TH110 — Schneider Electric",
        url: "https://www.se.com/uk/en/download/document/NVE62740/",
      },
      { label: "Compatibilidade e firmware — Schneider Electric", url: PANEL_SERVER_RELEASE_NOTES_URL },
      { label: "Comunicação do Panel Server — Schneider Electric", url: PANEL_SERVER_GUIDE_URL },
      { label: "Capacidade do sistema — Schneider Electric", url: PANEL_SERVER_SYSTEM_URL },
    ],
  },
} as const satisfies Record<string, CommercialSensorProfile>;

export function selectCommercialSensorProfile(input: {
  componentType: ElectricalComponentType;
  ratedCurrent: number;
}): CommercialSensorProfile {
  if (input.ratedCurrent >= 100 || input.componentType === "BUSBAR" || input.componentType === "TERMINAL") {
    return COMMERCIAL_SENSOR_PROFILES.POWERLOGIC_TH110;
  }

  return COMMERCIAL_SENSOR_PROFILES.POWERLOGIC_THERMAL_TAG_SPTH150S;
}

export function selectReferenceGateway(pointCode: string): {
  assetTag: "PAS800-A" | "PAS800-B";
  scope: string;
} {
  const pointNumber = Number(pointCode.match(/^TP-(\d{3})$/)?.[1]);
  if (!Number.isInteger(pointNumber) || pointNumber < 1 || pointNumber > 55) {
    throw new Error(`Código de ponto inválido para o mapa de gateways: ${pointCode}`);
  }

  return pointNumber <= 28
    ? { assetTag: "PAS800-A", scope: "Esterilização, secagem e câmara fria — 28 pontos" }
    : { assetTag: "PAS800-B", scope: "Centrifugação e utilidades — 27 pontos" };
}

export function findCommercialSensorProfile(
  manufacturer: string | null | undefined,
  model: string | null | undefined
): CommercialSensorProfile | null {
  if (!manufacturer || !model || manufacturer.trim().toLowerCase() !== "schneider electric") return null;

  const normalizedModel = model.trim().toLowerCase();
  return (
    Object.values(COMMERCIAL_SENSOR_PROFILES).find(
      (profile) =>
        normalizedModel === profile.model.toLowerCase() ||
        normalizedModel.includes(profile.commercialReference.toLowerCase())
    ) ?? null
  );
}
