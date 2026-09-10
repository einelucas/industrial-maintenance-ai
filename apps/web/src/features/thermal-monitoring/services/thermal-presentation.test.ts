import { describe, expect, it } from "vitest";
import { currentPointRisk, filterMonitoringPoints, inferenceAge, isTraceablePrediction, numeric, pointConnectivity, summarizeMonitoringPoints, type TraceablePrediction } from "./thermal-presentation";
import { workOrderBlockReason } from "@/features/thermal-incidents/services/incident-presentation";

import { predictionFixture } from "./thermal-presentation.fixture";
describe("apresentação térmica fail-closed", () => {
  it("apresenta risco crítico apenas com inferência válida da leitura atual", () => {
    expect(currentPointRisk({ id: "reading", analysisStatus: "ANALYZED" }, predictionFixture(), "READY")).toBe("CRITICAL");
  });
  it.each(["AI_CORE_UNAVAILABLE", "DEGRADED"] as const)("bloqueia risco atual quando %s", (status) => {
    expect(currentPointRisk({ id: "reading", analysisStatus: "ANALYZED" }, predictionFixture(), status)).toBeNull();
  });
  it("não considera normal um ponto sem leitura ou inferência", () => {
    expect(currentPointRisk(undefined, undefined, "READY")).toBeNull();
    expect(currentPointRisk({ id: "reading", analysisStatus: "ANALYZED" }, undefined, "READY")).toBeNull();
  });
  it.each(["PENDING_AI", "AI_FAILED", "SUPERSEDED"] as const)("não herda risco da análise antiga em %s", (analysisStatus) => {
    expect(currentPointRisk({ id: "new-reading", analysisStatus }, predictionFixture({ riskLevel: "LOW" }), "READY")).toBeNull();
  });
  it.each([
    { modelStage: "RULE_ONLY" }, { modelChecksum: "invalid" }, { modelScore: null }, { inferenceId: null },
    { confidence: 10 }, { explanations: [] }, { thermalReadingId: "unrelated" }, { featureVersion: "other" }, { inferenceRequest: null },
  ] as Partial<TraceablePrediction>[])("rejeita evidência incompleta/incompatível: %j", (overrides) => {
    expect(isTraceablePrediction(predictionFixture(overrides))).toBe(false);
  });
  it("rejeita requisição que pertence a outro ponto", () => {
    const prediction = predictionFixture();
    prediction.inferenceRequest!.thermalPointId = "other";
    expect(isTraceablePrediction(prediction)).toBe(false);
  });
  it("rejeita inferência cujo processamento não concluiu", () => {
    const prediction = predictionFixture();
    prediction.inferenceRequest!.status = "FAILED";
    expect(isTraceablePrediction(prediction)).toBe(false);
  });
  it("mantém 55 pontos pendentes e 19 fatos históricos sem fabricar normais", () => {
    const points = Array.from({ length: 55 }, (_, i) => ({ initiallyAnomalous: i < 19, currentRisk: null, connectivity: "NOT_APPLICABLE" as const }));
    expect(summarizeMonitoringPoints(points)).toEqual({ total: 55, counts: { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 }, unclassified: 55, offline: 0 });
  });
  it("aplica todos os filtros em conjunto e não perde severidade crítica", () => {
    const critical = { code: "TP-039", name: "Conexão", currentRisk: "CRITICAL" as const, historicalPriority: "P20" as const, connectivity: "OFFLINE" as const, component: { id: "component", panel: { id: "panel", sectorId: "sector", equipmentId: "equipment" } } };
    const pending = { ...critical, code: "TP-040", currentRisk: null };
    const filters = { search: "tp-039", sectorId: "sector", equipmentId: "equipment", panelId: "panel", componentId: "component", risk: "CRITICAL", connectivity: "OFFLINE" };
    expect(filterMonitoringPoints([critical, pending], filters)).toEqual([critical]);
    expect(filterMonitoringPoints([critical, pending], { ...filters, sectorId: "other" })).toEqual([]);
    expect(filterMonitoringPoints([critical, pending], { risk: "PENDING_AI" })).toEqual([pending]);
    expect(filterMonitoringPoints([critical, pending], { companyPriority: "P20" })).toEqual([critical, pending]);
  });
  it("mantém ausência distinta de zero e informa idade real", () => {
    expect(numeric(null)).toBe("—"); expect(numeric(0, " °C")).toBe("0 °C");
    expect(inferenceAge(undefined, new Date())).toBe("Nenhuma inferência válida");
    expect(inferenceAge(new Date("2026-09-08T11:00:00Z"), new Date("2026-09-08T12:00:00Z"))).toBe("1 h");
  });
});

describe("conectividade independente do risco", () => {
  const now = new Date("2026-09-08T12:00:00Z");
  const base = { monitoringMode: "POINT_SENSOR" as const, sampleIntervalSec: 60, devices: [{ status: "ONLINE" as const, lastSeenAt: new Date("2026-09-08T11:59:00Z") }] };
  it("usa o último contato e três intervalos de tolerância", () => {
    expect(pointConnectivity(base, now)).toBe("ONLINE");
    expect(pointConnectivity(base, new Date("2026-09-08T12:03:00Z"))).toBe("OFFLINE");
  });
  it("respeita estado offline mesmo com horário recente", () => {
    expect(pointConnectivity({ ...base, devices: [{ status: "OFFLINE", lastSeenAt: now }] }, now)).toBe("OFFLINE");
  });
  it("não classifica coleta manual ou simulada como sensor offline", () => {
    expect(pointConnectivity({ ...base, monitoringMode: "MANUAL", devices: [] }, now)).toBe("NOT_APPLICABLE");
    expect(pointConnectivity({ ...base, monitoringMode: "SIMULATOR" }, now)).toBe("NOT_APPLICABLE");
  });
  it("não considera revogado como dispositivo operacional", () => {
    expect(pointConnectivity({ ...base, devices: [{ status: "DISABLED", lastSeenAt: now }] }, now)).toBe("UNPROVISIONED");
  });
});

describe("elegibilidade da OS na interface", () => {
  const eligible = { aiStatus: "READY", canConvert: true, status: "HUMAN_CONFIRMED", decision: "CONFIRMED", workOrderId: null, equipmentId: "real-equipment", validEvidence: true, finalCompanyPriority: "P20", priorityPolicyVersion: "policy-v1" };
  it("habilita somente com confirmação, permissão, IA pronta e equipamento real", () => {
    expect(workOrderBlockReason(eligible)).toBeNull();
  });
  it.each([{ aiStatus: "AI_CORE_UNAVAILABLE" }, { aiStatus: "DEGRADED" }, { canConvert: false }, { status: "PENDING_HUMAN_REVIEW", decision: null }, { status: "HUMAN_REJECTED", decision: "REJECTED" }, { equipmentId: null }, { workOrderId: "existing" }, { validEvidence: false }, { finalCompanyPriority: null }, { priorityPolicyVersion: null }])("explica o bloqueio: %j", (change) => {
    expect(workOrderBlockReason({ ...eligible, ...change })).toEqual(expect.any(String));
  });
});
