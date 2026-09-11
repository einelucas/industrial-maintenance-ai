import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_SENSOR_PROFILES,
  findCommercialSensorProfile,
  selectCommercialSensorProfile,
  selectReferenceGateway,
} from "./commercial-sensor-catalog";

describe("commercialSensorCatalog", () => {
  it("usa o Thermal Tag SPTH150S nos componentes de baixa corrente", () => {
    const profile = selectCommercialSensorProfile({ componentType: "THERMAL_RELAY", ratedCurrent: 32 });
    expect(profile.commercialReference).toBe("SPTH150S");
  });

  it("usa o TH110 nas conexões de alta corrente do painel de utilidades", () => {
    for (const componentType of ["CIRCUIT_BREAKER", "BUSBAR", "TERMINAL"] as const) {
      const profile = selectCommercialSensorProfile({ componentType, ratedCurrent: 100 });
      expect(profile.commercialReference).toBe("EMS59440");
    }
  });

  it("localiza um perfil persistido pelo fabricante e pela referência comercial", () => {
    expect(findCommercialSensorProfile("Schneider Electric", "PowerLogic TH110 (EMS59440)"))
      .toBe(COMMERCIAL_SENSOR_PROFILES.POWERLOGIC_TH110);
    expect(findCommercialSensorProfile("Fabricante customizado", "EMS59440")).toBeNull();
  });

  it("divide os 55 pontos entre dois gateways sem ultrapassar 40 sensores por unidade", () => {
    const assignments = Array.from({ length: 55 }, (_, index) =>
      selectReferenceGateway(`TP-${String(index + 1).padStart(3, "0")}`).assetTag
    );
    expect(assignments.filter((gateway) => gateway === "PAS800-A")).toHaveLength(28);
    expect(assignments.filter((gateway) => gateway === "PAS800-B")).toHaveLength(27);
  });
});
