import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Testes de integração da cadeia AI-first completa (GPMS 2026 / Etapa 5):
//
//   ThermalReading -> features -> gateway -> Prediction -> ThermalIncident
//   -> Alert -> revisão humana -> WorkOrder PREDICTIVE
//
// `fetch` é mockado (nunca chama um FastAPI de verdade) — é o único jeito
// autorizado de simular uma resposta válida de IA nesta etapa (seção
// "distinção obrigatória entre estrutura e funcionamento real" do prompt).
// Essas respostas simuladas NUNCA alimentam o banco demonstrativo: tudo
// aqui roda contra fixtures próprias, criadas e destruídas por esta
// suíte, seguindo à risca as 10 regras de segurança de banco já
// estabelecidas (nunca `deleteMany()` sem filtro, limpeza só por id
// rastreado, nunca mexe no cenário determinístico da Etapa 2/TP-039).
//
// Exige TEST_DATABASE_URL (mesma limitação já documentada nas suítes
// anteriores: DATABASE_URL e TEST_DATABASE_URL devem apontar para o mesmo
// banco neste ambiente, pois os services usam o client singleton de
// `@/lib/db/client`, que só lê `DATABASE_URL`).
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("Orquestração AI-first — integração PostgreSQL (Etapa 5)", () => {
  let prisma: PrismaClient;
  const runId = randomUUID().slice(0, 8);
  let seq = 0;
  const unique = (label: string) => `${label}-${runId}-${seq++}`;

  const createdIds = {
    humanReview: [] as string[],
    workOrderHistory: [] as string[],
    workOrder: [] as string[],
    alert: [] as string[],
    thermalIncident: [] as string[],
    inferenceRequest: [] as string[],
    prediction: [] as string[],
    thermalReading: [] as string[],
    thermalPoint: [] as string[],
    monitoredComponent: [] as string[],
    electricalPanel: [] as string[],
    equipment: [] as string[],
    sector: [] as string[],
    user: [] as string[],
  };

  let sectorId: string;
  let equipmentId: string;
  let reviewerId: string;
  let panelId: string;
  let componentId: string;

  const READY_HEALTH_BODY = {
    status: "ok",
    modelLoaded: true,
    predictorType: "thermal",
    modelStage: "SYNTHETIC_EXPERIMENTAL",
    modelVersion: "thermal-synth-2026.09.01-test",
    modelChecksum: "sha256:" + "b".repeat(64),
  };

  function criticalPredictionBodyFor(requestBody: { inferenceRequestId: string; thermalReadingId: string }) {
    return {
      inferenceId: `inf-${requestBody.thermalReadingId}`,
      inferenceRequestId: requestBody.inferenceRequestId,
      modelVersion: READY_HEALTH_BODY.modelVersion,
      modelChecksum: READY_HEALTH_BODY.modelChecksum,
      modelStage: "SYNTHETIC_EXPERIMENTAL",
      // O piso crítico pode elevar o risco mesmo com probabilidade
      // supervisionada baixa; os dois valores não podem ser confundidos.
      supervisedFailureProbability: 0.04,
      modelScore: 92.8,
      riskScore: 96.4,
      riskLevel: "CRITICAL",
      confidence: 0.91,
      predictedFailureMode: "CONTACT_RESISTANCE",
      failureModeConfidence: 0.84,
      explanations: ["ΔT muito acima da referência para este ponto — teste isolado."],
      recommendedAction: "Inspecionar contator (cenário de teste).",
    };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL as string } } });

    const sector = await prisma.sector.create({ data: { name: unique("sector") } });
    sectorId = sector.id;
    createdIds.sector.push(sector.id);

    const equipment = await prisma.equipment.create({
      data: { tag: unique("equip"), name: "Equipamento de teste (Etapa 5)", category: "TESTE", sectorId },
    });
    equipmentId = equipment.id;
    createdIds.equipment.push(equipment.id);

    const reviewer = await prisma.user.create({
      data: { name: "Revisor de teste", email: `${unique("reviewer")}@example.test`, passwordHash: "hash", role: "PLANNER" },
    });
    reviewerId = reviewer.id;
    createdIds.user.push(reviewer.id);

    // Painel COM equipamento real — necessário para a OS preditiva (nunca
    // fabricamos um Equipment falso; este teste exercita o caminho feliz
    // onde ele existe de verdade).
    const panel = await prisma.electricalPanel.create({
      data: { tag: unique("panel"), name: "Painel de teste", panelType: "MCC", sectorId, equipmentId },
    });
    panelId = panel.id;
    createdIds.electricalPanel.push(panel.id);

    const component = await prisma.monitoredComponent.create({
      data: { tag: unique("cmp"), name: "Componente de teste", componentType: "CONTACTOR", panelId },
    });
    componentId = component.id;
    createdIds.monitoredComponent.push(component.id);
  });

  afterAll(async () => {
    // Ordem segura para FKs Restrict: filhos antes dos pais.
    await prisma.humanReview.deleteMany({ where: { id: { in: createdIds.humanReview } } });
    await prisma.workOrderHistory.deleteMany({ where: { id: { in: createdIds.workOrderHistory } } });
    await prisma.alert.deleteMany({ where: { id: { in: createdIds.alert } } });
    await prisma.thermalIncident.deleteMany({ where: { id: { in: createdIds.thermalIncident } } });
    await prisma.workOrder.deleteMany({ where: { id: { in: createdIds.workOrder } } });
    await prisma.inferenceRequest.deleteMany({ where: { id: { in: createdIds.inferenceRequest } } });
    await prisma.prediction.deleteMany({ where: { id: { in: createdIds.prediction } } });
    await prisma.thermalReading.deleteMany({ where: { id: { in: createdIds.thermalReading } } });
    await prisma.thermalPoint.deleteMany({ where: { id: { in: createdIds.thermalPoint } } });
    await prisma.monitoredComponent.deleteMany({ where: { id: { in: createdIds.monitoredComponent } } });
    await prisma.electricalPanel.deleteMany({ where: { id: { in: createdIds.electricalPanel } } });
    await prisma.equipment.deleteMany({ where: { id: { in: createdIds.equipment } } });
    await prisma.sector.deleteMany({ where: { id: { in: createdIds.sector } } });
    await prisma.user.deleteMany({ where: { id: { in: createdIds.user } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/api/v1/thermal/health")) {
          return { ok: true, status: 200, json: async () => READY_HEALTH_BODY } as Response;
        }
        if (url.endsWith("/api/v1/thermal/predict")) {
          const body = JSON.parse(init!.body as string);
          return { ok: true, status: 200, json: async () => criticalPredictionBodyFor(body) } as Response;
        }
        throw new Error(`fetch inesperado nesta suíte isolada: ${url}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function createPointWithHistory(codeLabel: string) {
    const point = await prisma.thermalPoint.create({
      data: { code: unique(codeLabel), name: "Ponto de teste (Etapa 5)", componentId, monitoringMode: "MANUAL", active: true },
    });
    createdIds.thermalPoint.push(point.id);

    const now = new Date("2026-09-04T12:00:00.000Z");
    // 10 leituras históricas espaçadas 2h (baseline.sufficient exige >= 10
    // amostras anteriores) + 1 leitura a -30min (garante >= 2 pontos na
    // janela de tendência de 60min junto com a leitura-alvo).
    const readingIds: string[] = [];
    for (let i = 10; i >= 1; i--) {
      const reading = await prisma.thermalReading.create({
        data: {
          thermalPointId: point.id,
          measuredAt: new Date(now.getTime() - i * 2 * 60 * 60_000),
          temperatureMaxC: 50 + i,
          referenceTemperatureC: 40,
          deltaTC: 10 + i,
          source: "MANUAL",
        },
      });
      createdIds.thermalReading.push(reading.id);
      readingIds.push(reading.id);
    }
    const nearReading = await prisma.thermalReading.create({
      data: {
        thermalPointId: point.id,
        measuredAt: new Date(now.getTime() - 30 * 60_000),
        temperatureMaxC: 60,
        referenceTemperatureC: 40,
        deltaTC: 20,
        source: "MANUAL",
      },
    });
    createdIds.thermalReading.push(nearReading.id);

    const targetReading = await prisma.thermalReading.create({
      data: {
        thermalPointId: point.id,
        measuredAt: now,
        temperatureMaxC: 75.6,
        referenceTemperatureC: 40,
        deltaTC: 35.6,
        source: "MANUAL",
      },
    });
    createdIds.thermalReading.push(targetReading.id);

    return { point, targetReading };
  }

  it("fail-closed: núcleo de IA indisponível preserva a leitura como PENDING_AI e não cria Prediction/Incidente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: "ok", modelLoaded: true, predictorType: "sklearn" }) }) as Response)
    );

    const { thermalOrchestratorService } = await import("@/features/ai-core/services/thermal-orchestrator.service");
    const { inferenceRequestRepository } = await import("@/features/ai-core/repositories/inference-request.repository");
    const { buildInferenceRequestId } = await import("@/features/ai-core/services/inference-request-id");
    const { THERMAL_FEATURE_VERSION } = await import("@/features/ai-core/temporal-features/calculate-temporal-features");

    const { point, targetReading } = await createPointWithHistory("TP-FAILCLOSED");
    const inferenceRequestId = buildInferenceRequestId(targetReading.id, THERMAL_FEATURE_VERSION);
    const request = await inferenceRequestRepository.upsertPending({
      inferenceRequestId,
      thermalReadingId: targetReading.id,
      thermalPointId: point.id,
      featureVersion: THERMAL_FEATURE_VERSION,
    });
    createdIds.inferenceRequest.push(request.id);

    const result = await thermalOrchestratorService.processInferenceRequest(inferenceRequestId);
    expect(result.outcome).toBe("TRANSIENT_FAILURE");

    const readingAfter = await prisma.thermalReading.findUniqueOrThrow({ where: { id: targetReading.id } });
    expect(readingAfter.analysisStatus).toBe("PENDING_AI");

    const predictionCount = await prisma.prediction.count({ where: { thermalReadingId: targetReading.id } });
    const incidentCount = await prisma.thermalIncident.count({ where: { thermalPointId: point.id } });
    expect(predictionCount).toBe(0);
    expect(incidentCount).toBe(0);
  });

  it("cadeia positiva completa: Prediction rastreável -> ThermalIncident PENDING_HUMAN_REVIEW -> Alert consolidado", async () => {
    const { thermalOrchestratorService } = await import("@/features/ai-core/services/thermal-orchestrator.service");
    const { inferenceRequestRepository } = await import("@/features/ai-core/repositories/inference-request.repository");
    const { buildInferenceRequestId } = await import("@/features/ai-core/services/inference-request-id");
    const { THERMAL_FEATURE_VERSION } = await import("@/features/ai-core/temporal-features/calculate-temporal-features");

    const { point, targetReading } = await createPointWithHistory("TP-CHAIN");
    const inferenceRequestId = buildInferenceRequestId(targetReading.id, THERMAL_FEATURE_VERSION);
    const request = await inferenceRequestRepository.upsertPending({
      inferenceRequestId,
      thermalReadingId: targetReading.id,
      thermalPointId: point.id,
      featureVersion: THERMAL_FEATURE_VERSION,
    });
    createdIds.inferenceRequest.push(request.id);

    const result = await thermalOrchestratorService.processInferenceRequest(inferenceRequestId);
    expect(result.outcome).toBe("SUCCEEDED");
    expect(result.predictionId).toBeTruthy();
    expect(result.incidentId).toBeTruthy();
    if (result.predictionId) createdIds.prediction.push(result.predictionId);
    if (result.incidentId) createdIds.thermalIncident.push(result.incidentId);

    const prediction = await prisma.prediction.findUniqueOrThrow({ where: { id: result.predictionId! } });
    expect(prediction.thermalReadingId).toBe(targetReading.id);
    expect(prediction.thermalPointId).toBe(point.id);
    expect(prediction.riskLevel).toBe("CRITICAL");
    expect(prediction.modelScore).toBe(92.8);
    expect(prediction.failureProbability).toBe(0.04);
    expect(prediction.predictedClass).toBe(0);
    expect(prediction.inferenceId).toBe(`inf-${targetReading.id}`);
    expect(prediction.featureVersion).toBe(THERMAL_FEATURE_VERSION);
    expect(prediction.equipmentId).toBeNull(); // Prediction nunca herda equipmentId sozinha

    const readingAfter = await prisma.thermalReading.findUniqueOrThrow({ where: { id: targetReading.id } });
    expect(readingAfter.analysisStatus).toBe("ANALYZED");

    const requestAfter = await prisma.inferenceRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(requestAfter.status).toBe("SUCCEEDED");
    expect(requestAfter.predictionId).toBe(result.predictionId);

    const incident = await prisma.thermalIncident.findUniqueOrThrow({ where: { id: result.incidentId! } });
    expect(incident.status).toBe("PENDING_HUMAN_REVIEW");
    expect(incident.triggerPredictionId).toBe(result.predictionId);
    expect(incident.severity).toBe("CRITICAL");

    const alert = await prisma.alert.findUnique({ where: { thermalIncidentId: incident.id } });
    expect(alert).not.toBeNull();
    expect(alert!.equipmentId).toBe(equipmentId); // painel tem equipamento real
    if (alert) createdIds.alert.push(alert.id);

    // Idempotência: reprocessar a MESMA InferenceRequest é um no-op seguro —
    // não duplica Prediction nem Incidente.
    const secondResult = await thermalOrchestratorService.processInferenceRequest(inferenceRequestId);
    expect(secondResult.outcome).toBe("ALREADY_PROCESSED");
    const predictionCountAfter = await prisma.prediction.count({ where: { thermalReadingId: targetReading.id } });
    expect(predictionCountAfter).toBe(1);

    // --- Revisão humana ---
    const { humanReviewService } = await import("@/features/thermal-incidents/services/human-review.service");
    const reviewed = await humanReviewService.submit({ thermalIncidentId: incident.id, decision: "CONFIRMED" }, reviewerId);
    expect(reviewed.status).toBe("HUMAN_CONFIRMED");
    expect(reviewed.humanReviewDecision).toBe("CONFIRMED");

    const reviews = await prisma.humanReview.findMany({ where: { thermalIncidentId: incident.id } });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]!.decision).toBe("CONFIRMED");
    expect(reviews[0]!.previousStatus).toBe("PENDING_HUMAN_REVIEW");
    expect(reviews[0]!.nextStatus).toBe("HUMAN_CONFIRMED");
    reviews.forEach((r) => createdIds.humanReview.push(r.id));

    // --- OS preditiva dedicada ---
    const { predictiveWorkOrderService } = await import("@/features/thermal-incidents/services/predictive-work-order.service");
    const workOrder = await predictiveWorkOrderService.createFromConfirmedIncident({ thermalIncidentId: incident.id }, reviewerId);
    createdIds.workOrder.push(workOrder.id);
    expect(workOrder.type).toBe("PREDICTIVE");
    expect(workOrder.sourcePredictionId).toBe(result.predictionId);
    expect(workOrder.equipmentId).toBe(equipmentId);
    expect(workOrder.thermalPointId).toBe(point.id);

    const history = await prisma.workOrderHistory.findMany({ where: { workOrderId: workOrder.id } });
    history.forEach((h) => createdIds.workOrderHistory.push(h.id));
    expect(history.length).toBeGreaterThanOrEqual(1);

    const incidentAfterWorkOrder = await prisma.thermalIncident.findUniqueOrThrow({ where: { id: incident.id } });
    expect(incidentAfterWorkOrder.status).toBe("WORK_ORDER_CREATED");
    expect(incidentAfterWorkOrder.workOrderId).toBe(workOrder.id);

    // Uma segunda tentativa de criar OS para o MESMO incidente é rejeitada.
    await expect(predictiveWorkOrderService.createFromConfirmedIncident({ thermalIncidentId: incident.id }, reviewerId)).rejects.toThrow();
  });

  it("formulário genérico de OS continua rejeitando PREDICTIVE mesmo depois desta etapa", async () => {
    const { createWorkOrderSchema } = await import("@/features/work-orders/schemas/work-order.schema");
    const result = createWorkOrderSchema.safeParse({
      title: "Tentativa de bypass",
      type: "PREDICTIVE",
      priority: "HIGH",
      equipmentId,
    });
    expect(result.success).toBe(false);
  });
});
