import { prisma } from "@/lib/db/client";
import { predictiveAiClient } from "@/features/predictions/services/predictive-ai.client";
import { predictionRepository } from "@/features/predictions/repositories/prediction.repository";
import type { SensorReading } from "@prisma/client";

/**
 * Faixas de severidade de Alert derivadas do riskLevel retornado pela IA.
 * Alertas são criados para MODERATE/HIGH/CRITICAL — LOW não gera alerta,
 * apenas fica registrado como histórico da Prediction (decisão documentada
 * em docs/predictive-maintenance.md, seção não detalhada explicitamente no
 * escopo original).
 */
const ALERT_ELIGIBLE_LEVELS = new Set(["MODERATE", "HIGH", "CRITICAL"]);

export const predictionService = {
  /**
   * Orquestra o fluxo completo: envia a leitura ao FastAPI, persiste a
   * Prediction (histórico nunca sobrescrito) e, se aplicável, cria um Alert.
   * Nunca gera OS automaticamente — isso exige ação humana do planejador
   * (seção 22).
   */
  async runPredictionForReading(reading: SensorReading) {
    const result = await predictiveAiClient.predictFailure({
      equipmentId: reading.equipmentId,
      temperature: reading.temperature ?? undefined,
      vibration: reading.vibration ?? undefined,
      pressure: reading.pressure ?? undefined,
      rpm: reading.rpm ?? undefined,
      current: reading.current ?? undefined,
      torque: reading.torque ?? undefined,
      operatingHours: reading.operatingHours ?? undefined,
      airTemperature: reading.airTemperature ?? undefined,
      processTemperature: reading.processTemperature ?? undefined,
      toolWear: reading.toolWear ?? undefined,
      rotationalSpeed: reading.rotationalSpeed ?? undefined,
    });

    const prediction = await predictionRepository.create({
      equipment: { connect: { id: reading.equipmentId } },
      failureProbability: result.failureProbability,
      riskLevel: result.riskLevel,
      predictedClass: result.predictedClass,
      modelVersion: result.isDemoModel ? `${result.modelVersion} (demo)` : result.modelVersion,
      inputSnapshot: {
        temperature: reading.temperature,
        vibration: reading.vibration,
        pressure: reading.pressure,
        rpm: reading.rpm,
        current: reading.current,
        torque: reading.torque,
        operatingHours: reading.operatingHours,
        airTemperature: reading.airTemperature,
        processTemperature: reading.processTemperature,
        toolWear: reading.toolWear,
        rotationalSpeed: reading.rotationalSpeed,
        sensorReadingId: reading.id,
      },
      featuresUsed: result.featuresUsed,
    });

    if (ALERT_ELIGIBLE_LEVELS.has(result.riskLevel)) {
      await prisma.alert.create({
        data: {
          equipment: { connect: { id: reading.equipmentId } },
          prediction: { connect: { id: prediction.id } },
          type: "PREDICTIVE_RISK",
          severity: result.riskLevel,
          status: "OPEN",
          title: `Risco ${result.riskLevel === "CRITICAL" ? "crítico" : "elevado"} de falha detectado`,
          description: `Probabilidade de falha: ${(result.failureProbability * 100).toFixed(1)}%. Modelo: ${result.modelVersion}.`,
        },
      });
    }

    return prediction;
  },
};
