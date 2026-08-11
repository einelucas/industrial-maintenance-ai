import { describe, expect, it } from "vitest";
import { isWorkOrderDelayed } from "./work-order-delay.service";

describe("isWorkOrderDelayed", () => {
  const now = new Date("2026-08-10T12:00:00Z");

  it("retorna false quando não há scheduledEnd definido", () => {
    expect(isWorkOrderDelayed(null, "OPEN", now)).toBe(false);
  });

  it("retorna true quando scheduledEnd já passou e status é ativo", () => {
    const past = new Date("2026-08-01T00:00:00Z");
    expect(isWorkOrderDelayed(past, "OPEN", now)).toBe(true);
    expect(isWorkOrderDelayed(past, "IN_PROGRESS", now)).toBe(true);
    expect(isWorkOrderDelayed(past, "PLANNED", now)).toBe(true);
    expect(isWorkOrderDelayed(past, "WAITING_MATERIAL", now)).toBe(true);
    expect(isWorkOrderDelayed(past, "PAUSED", now)).toBe(true);
  });

  it("retorna false quando scheduledEnd ainda não passou", () => {
    const future = new Date("2026-09-01T00:00:00Z");
    expect(isWorkOrderDelayed(future, "OPEN", now)).toBe(false);
  });

  it("nunca considera atrasada uma OS COMPLETED, mesmo com prazo vencido", () => {
    const past = new Date("2026-08-01T00:00:00Z");
    expect(isWorkOrderDelayed(past, "COMPLETED", now)).toBe(false);
  });

  it("nunca considera atrasada uma OS CANCELED, mesmo com prazo vencido", () => {
    const past = new Date("2026-08-01T00:00:00Z");
    expect(isWorkOrderDelayed(past, "CANCELED", now)).toBe(false);
  });

  it("trata o exato instante do prazo como não atrasado (usa < estrito)", () => {
    expect(isWorkOrderDelayed(now, "OPEN", now)).toBe(false);
  });
});
