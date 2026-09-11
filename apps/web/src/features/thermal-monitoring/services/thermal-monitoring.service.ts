import { cache } from "react";
import { aiCoreStateService } from "@/features/ai-core/services/ai-core-state.service";
import { thermalInspectionService } from "@/features/thermal-inspections/services/thermal-inspection.service";
import { thermalMonitoringRepository } from "@/features/thermal-monitoring/repositories/thermal-monitoring.repository";
import { currentPointRisk, isTraceablePrediction, pointConnectivity, summarizeMonitoringPoints } from "./thermal-presentation";

// Uma consulta ao gateway por renderização, compartilhada entre layout e página.
export const getThermalAiState = cache(() => aiCoreStateService.getState());

export const thermalMonitoringService = {
  async dashboard() {
    const [rows, queue, queueMetrics, openIncidents, historicalDistribution, ai] = await Promise.all([
      thermalMonitoringRepository.points(), thermalMonitoringRepository.queue(), thermalMonitoringRepository.queueMetrics(), thermalMonitoringRepository.openIncidents(), thermalInspectionService.distribution(), getThermalAiState(),
    ]);
    const now = new Date();
    const points = rows.map((point) => {
      const prediction = point.predictions.find(isTraceablePrediction);
      return { ...point, prediction, historicalPriority: point.inspectionFindings[0]?.companyPriority ?? null, currentRisk: currentPointRisk(point.readings[0], prediction, ai.status), connectivity: pointConnectivity(point, now), hasOpenIncident: point.incidents.length > 0 };
    });
    return { points, queue, queueMetrics, openIncidents, historicalDistribution, ai, now, summary: summarizeMonitoringPoints(points) };
  },
};

export type MonitoringDashboard = Awaited<ReturnType<typeof thermalMonitoringService.dashboard>>;
export type MonitoringPoint = MonitoringDashboard["points"][number];
