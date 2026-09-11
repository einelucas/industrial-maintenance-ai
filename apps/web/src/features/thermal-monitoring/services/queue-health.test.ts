import { describe, expect, it } from "vitest";
import { queueHealthState } from "./queue-health";

const base = { pendingRequests: 0, orphanedReadings: 0, leasedCount: 0, failedRequests: 0, rejectedLastHour: 0, oldestPendingAt: null };
const now = new Date("2026-09-08T12:00:00Z");

describe("queueHealthState", () => {
  it("é saudável sem pendências, falhas ou rejeições", () => {
    expect(queueHealthState(base, now)).toEqual({ state: "healthy", reasons: [] });
  });

  it("fica em atenção com pendências normais", () => {
    expect(queueHealthState({ ...base, pendingRequests: 3 }, now).state).toBe("attention");
  });

  it("fica degradada com falhas de requisição", () => {
    const result = queueHealthState({ ...base, failedRequests: 1 }, now);
    expect(result.state).toBe("degraded");
    expect(result.reasons[0]).toContain("falha");
  });

  it("fica degradada com item pendente muito antigo", () => {
    const result = queueHealthState({ ...base, oldestPendingAt: new Date("2026-09-08T11:00:00Z") }, now);
    expect(result.state).toBe("degraded");
  });
});
