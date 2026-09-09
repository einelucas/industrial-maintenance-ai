import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runDailyAutomation } = vi.hoisted(() => ({ runDailyAutomation: vi.fn() }));

vi.mock("@/features/automation/services/daily-automation.service", () => ({ runDailyAutomation }));

import { GET } from "@/app/api/cron/daily-maintenance/route";

describe("GET /api/cron/daily-maintenance", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-daily-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("recusa chamada sem o segredo do cron", async () => {
    const response = await GET(new Request("http://localhost/api/cron/daily-maintenance"));

    expect(response.status).toBe(401);
    expect(runDailyAutomation).not.toHaveBeenCalled();
  });

  it("executa a automação uma vez e devolve o resumo estruturado", async () => {
    runDailyAutomation.mockResolvedValue({
      status: "SUCCEEDED",
      ranAt: "2026-09-09T10:00:00.000Z",
      preventive: { status: "SUCCEEDED", generatedCount: 0, generated: [] },
      thermal: { status: "SUCCEEDED", report: { processedCount: 25 } },
    });

    const response = await GET(
      new Request("http://localhost/api/cron/daily-maintenance", {
        headers: { authorization: "Bearer test-daily-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(runDailyAutomation).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      status: "SUCCEEDED",
      preventive: { generatedCount: 0 },
      thermal: { report: { processedCount: 25 } },
    });
  });

  it("expõe resultado parcial sem ocultar uma rotina bloqueada", async () => {
    runDailyAutomation.mockResolvedValue({
      status: "PARTIAL_FAILURE",
      ranAt: "2026-09-09T10:00:00.000Z",
      preventive: { status: "SUCCEEDED", generatedCount: 1, generated: [{}] },
      thermal: { status: "BLOCKED", error: "Núcleo de IA indisponível." },
    });

    const response = await GET(
      new Request("http://localhost/api/cron/daily-maintenance", {
        headers: { authorization: "Bearer test-daily-secret" },
      }),
    );

    expect(response.status).toBe(207);
    await expect(response.json()).resolves.toMatchObject({
      status: "PARTIAL_FAILURE",
      preventive: { generatedCount: 1 },
      thermal: { status: "BLOCKED" },
    });
  });
});
