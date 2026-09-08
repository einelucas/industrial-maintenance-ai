import { cache } from "react";
import { aiCoreStateService } from "@/features/ai-core/services/ai-core-state.service";
import { thermalMonitoringRepository } from "@/features/thermal-monitoring/repositories/thermal-monitoring.repository";
import { currentPointRisk, isTraceablePrediction, pointConnectivity, summarizeMonitoringPoints } from "./thermal-presentation";

// Uma consulta ao gateway por renderização, compartilhada entre layout e página.
export const getThermalAiState = cache(() => aiCoreStateService.getState());

export const thermalMonitoringService = {
  async dashboard() {
    const [rows, queue, openIncidents, ai] = await Promise.all([
      thermalMonitoringRepository.points(), thermalMonitoringRepository.queue(), thermalMonitoringRepository.openIncidents(), getThermalAiState(),
    ]);
    const now = new Date();
    const points = rows.map((point) => {
      const prediction = point.predictions.find(isTraceablePrediction);
      return { ...point, prediction, currentRisk: currentPointRisk(point.readings[0], prediction, ai.status), connectivity: pointConnectivity(point, now) };
    });
    return { points, queue, openIncidents, ai, now, summary: summarizeMonitoringPoints(points) };
  },
};
