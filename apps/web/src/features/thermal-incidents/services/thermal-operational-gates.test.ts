import { beforeEach, describe, expect, it, vi } from "vitest";
import { predictionFixture } from "@/features/thermal-monitoring/services/thermal-presentation.fixture";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    thermalIncident: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    prediction: { findFirst: vi.fn() }, humanReview: { create: vi.fn() },
    workOrder: { create: vi.fn() }, workOrderHistory: { create: vi.fn() },
  };
  return { tx, prisma: { thermalIncident: { findUnique: vi.fn() }, prediction: { findFirst: vi.fn() }, $transaction: vi.fn() }, state: vi.fn() };
});
vi.mock("@/lib/db/client", () => ({ prisma: mocks.prisma }));
vi.mock("@/features/ai-core/services/ai-core-state.service", () => ({ aiCoreStateService: { getState: mocks.state } }));
vi.mock("@/features/work-orders/services/work-order-number.service", () => ({ generateWorkOrderNumber: vi.fn().mockResolvedValue("OS-TEST") }));

import { humanReviewService } from "./human-review.service";
import { predictiveWorkOrderService } from "./predictive-work-order.service";
import { alertService } from "@/features/alerts/services/alert.service";
import { assertMechanicalWorkflowAvailable } from "@/features/predictions/services/legacy-mechanical-gate";

const incidentId = "00000000-0000-4000-8000-000000000001";
const predictionId = "00000000-0000-4000-8000-000000000002";
function evidence() {
  const prediction = predictionFixture({ id: predictionId });
  prediction.inferenceRequest!.predictionId = predictionId;
  return prediction;
}
function incident() {
  return { id: incidentId, thermalPointId: "point", triggerPredictionId: predictionId, triggerPrediction: evidence(),
    status: "HUMAN_CONFIRMED", humanReviewDecision: "CONFIRMED", workOrderId: null, severity: "CRITICAL", updatedAt: new Date("2026-09-08T12:00:00Z"),
    thermalPoint: { code: "TP-039", component: { panel: { equipmentId: "real-equipment" } } } };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.state.mockResolvedValue({ status: "READY" });
  mocks.prisma.thermalIncident.findUnique.mockResolvedValue(incident());
  mocks.prisma.prediction.findFirst.mockResolvedValue(evidence());
  mocks.prisma.$transaction.mockImplementation((fn) => fn(mocks.tx));
  mocks.tx.thermalIncident.findUnique.mockResolvedValue(incident());
  mocks.tx.prediction.findFirst.mockResolvedValue(evidence());
  mocks.tx.thermalIncident.update.mockResolvedValue(incident());
  mocks.tx.thermalIncident.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.workOrder.create.mockResolvedValue({ id: "order" });
});

describe("revisão humana — gates no servidor", () => {
  it.each(["CONFIRMED", "REJECTED", "INCONCLUSIVE", "NEW_READING_REQUIRED"])("registra %s e a Prediction efetivamente revisada", async (decision) => {
    await humanReviewService.submit({ thermalIncidentId: incidentId, expectedPredictionId: predictionId, decision, justification: "Evidência analisada pelo profissional" }, "reviewer");
    expect(mocks.tx.humanReview.create).toHaveBeenCalledWith({ data: expect.objectContaining({ reviewedPredictionId: predictionId, decision, reviewedById: "reviewer", justification: "Evidência analisada pelo profissional" }) });
  });
  it("não registra rejeição sem justificativa", async () => {
    await expect(humanReviewService.submit({ thermalIncidentId: incidentId, decision: "REJECTED" }, "reviewer")).rejects.toThrow("inválidos");
    expect(mocks.tx.humanReview.create).not.toHaveBeenCalled();
  });
  it("rejeita incidente cuja evidência de origem está incompleta", async () => {
    mocks.prisma.thermalIncident.findUnique.mockResolvedValue({ ...incident(), triggerPrediction: { ...evidence(), modelChecksum: null } });
    await expect(humanReviewService.submit({ thermalIncidentId: incidentId, decision: "CONFIRMED" }, "reviewer")).rejects.toThrow("Prediction de origem");
    expect(mocks.tx.humanReview.create).not.toHaveBeenCalled();
  });
  it.each(["AI_CORE_UNAVAILABLE", "DEGRADED"])("permite revisão histórica com %s, sem produzir nova inferência ou OS", async (status) => {
    mocks.state.mockResolvedValue({ status });
    await humanReviewService.submit({ thermalIncidentId: incidentId, decision: "CONFIRMED" }, "reviewer");
    expect(mocks.tx.humanReview.create).toHaveBeenCalled();
    expect(mocks.tx.workOrder.create).not.toHaveBeenCalled();
    expect(mocks.state).not.toHaveBeenCalled();
  });
  it("não confirma silenciosamente uma inferência diferente da exibida", async () => {
    await expect(humanReviewService.submit({ thermalIncidentId: incidentId, decision: "CONFIRMED", expectedPredictionId: incidentId }, "reviewer")).rejects.toThrow("nova inferência");
    expect(mocks.tx.humanReview.create).not.toHaveBeenCalled();
  });
  it("detecta mudança do incidente durante a submissão", async () => {
    mocks.tx.thermalIncident.findUnique.mockResolvedValue({ ...incident(), status: "WORK_ORDER_CREATED", workOrderId: "order" });
    await expect(humanReviewService.submit({ thermalIncidentId: incidentId, decision: "CONFIRMED" }, "reviewer")).rejects.toThrow("atualizado");
    expect(mocks.tx.humanReview.create).not.toHaveBeenCalled();
  });
  it("detecta mudança da inferência dentro da transação", async () => {
    mocks.tx.prediction.findFirst.mockResolvedValue({ id: "new-prediction" });
    await expect(humanReviewService.submit({ thermalIncidentId: incidentId, decision: "CONFIRMED" }, "reviewer")).rejects.toThrow("nova inferência");
    expect(mocks.tx.humanReview.create).not.toHaveBeenCalled();
  });
});

describe("OS preditiva — gates no servidor", () => {
  it("cria OS com ponto, equipamento e Prediction rastreáveis", async () => {
    await predictiveWorkOrderService.createFromConfirmedIncident({ thermalIncidentId: incidentId }, "planner");
    expect(mocks.tx.workOrder.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "PREDICTIVE", thermalPoint: { connect: { id: "point" } }, equipment: { connect: { id: "real-equipment" } }, sourcePrediction: { connect: { id: predictionId } } }) });
  });
  it.each(["PENDING_HUMAN_REVIEW", "HUMAN_REJECTED", "INCONCLUSIVE", "NEW_READING_REQUIRED"])("bloqueia OS em %s", async (status) => {
    mocks.prisma.thermalIncident.findUnique.mockResolvedValue({ ...incident(), status });
    await expect(predictiveWorkOrderService.createFromConfirmedIncident({ thermalIncidentId: incidentId }, "planner")).rejects.toThrow("confirmado");
    expect(mocks.tx.workOrder.create).not.toHaveBeenCalled();
  });
  it.each(["AI_CORE_UNAVAILABLE", "DEGRADED"])("bloqueia OS em %s", async (status) => {
    mocks.state.mockResolvedValue({ status });
    await expect(predictiveWorkOrderService.createFromConfirmedIncident({ thermalIncidentId: incidentId }, "planner")).rejects.toThrow("bloqueada");
    expect(mocks.tx.workOrder.create).not.toHaveBeenCalled();
  });
  it("bloqueia evidência incompleta", async () => {
    mocks.prisma.thermalIncident.findUnique.mockResolvedValue({ ...incident(), triggerPrediction: { ...evidence(), modelChecksum: null } });
    await expect(predictiveWorkOrderService.createFromConfirmedIncident({ thermalIncidentId: incidentId }, "planner")).rejects.toThrow("Prediction");
    expect(mocks.tx.workOrder.create).not.toHaveBeenCalled();
  });
  it("não fabrica equipamento para painel setorial", async () => {
    mocks.prisma.thermalIncident.findUnique.mockResolvedValue({ ...incident(), thermalPoint: { component: { panel: { equipmentId: null } } } });
    await expect(predictiveWorkOrderService.createFromConfirmedIncident({ thermalIncidentId: incidentId }, "planner")).rejects.toThrow("equipamento real");
  });
  it("impede duplicação ou autorização revogada entre consulta e gravação", async () => {
    mocks.tx.thermalIncident.updateMany.mockResolvedValue({ count: 0 });
    await expect(predictiveWorkOrderService.createFromConfirmedIncident({ thermalIncidentId: incidentId }, "planner")).rejects.toThrow("atualizado");
    expect(mocks.tx.workOrder.create).not.toHaveBeenCalled();
  });
  it("fecha os caminhos mecânicos antigos", async () => {
    await expect(alertService.convertToWorkOrder("alert", "planner")).rejects.toThrow("legada desativada");
    expect(assertMechanicalWorkflowAvailable).toThrow("mecânico desativado");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});
