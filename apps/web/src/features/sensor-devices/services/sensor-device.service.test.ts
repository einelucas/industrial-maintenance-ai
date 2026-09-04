import { describe, expect, it } from "vitest";
import { sensorDeviceService } from "./sensor-device.service";

describe("sensorDeviceService.isAuthorizedForPoint", () => {
  const POINT_A = "point-a";
  const POINT_B = "point-b";

  it("autoriza quando o ponto solicitado é o mesmo do provisionamento e o status permite operação", () => {
    for (const status of ["PROVISIONING", "ONLINE", "OFFLINE", "DEGRADED"]) {
      expect(sensorDeviceService.isAuthorizedForPoint({ thermalPointId: POINT_A, status }, POINT_A)).toBe(true);
    }
  });

  it("rejeita quando o dispositivo tenta operar para outro ponto termográfico, mesmo com status válido", () => {
    expect(sensorDeviceService.isAuthorizedForPoint({ thermalPointId: POINT_A, status: "ONLINE" }, POINT_B)).toBe(false);
  });

  it("rejeita dispositivo com credencial revogada (DISABLED), mesmo para o ponto correto", () => {
    expect(sensorDeviceService.isAuthorizedForPoint({ thermalPointId: POINT_A, status: "DISABLED" }, POINT_A)).toBe(false);
  });

  it("rejeita dispositivo em manutenção (MAINTENANCE), mesmo para o ponto correto", () => {
    expect(sensorDeviceService.isAuthorizedForPoint({ thermalPointId: POINT_A, status: "MAINTENANCE" }, POINT_A)).toBe(
      false
    );
  });
});
