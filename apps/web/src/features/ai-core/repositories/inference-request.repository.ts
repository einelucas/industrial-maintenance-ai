import { prisma } from "@/lib/db/client";
import type { Prisma, InferenceRequestStatus } from "@prisma/client";

// Fila de inferência (GPMS 2026 / Etapa 5) — único lugar que lê/escreve
// `InferenceRequest`. `inferenceRequestId` é sempre a chave determinística
// (thermalReadingId + featureVersion), então `upsertPending` é naturalmente
// idempotente: chamá-lo duas vezes para a mesma leitura/versão nunca cria
// duas linhas (constraint única no banco garante isso mesmo sob concorrência).
export const inferenceRequestRepository = {
  findByInferenceRequestId: (inferenceRequestId: string) =>
    prisma.inferenceRequest.findUnique({ where: { inferenceRequestId } }),

  async upsertPending(data: { inferenceRequestId: string; thermalReadingId: string; thermalPointId: string; featureVersion: string }) {
    return prisma.inferenceRequest.upsert({
      where: { inferenceRequestId: data.inferenceRequestId },
      create: { ...data, status: "PENDING" },
      // Já existe — nunca sobrescreve o histórico de tentativas de uma
      // requisição existente só porque o enqueue rodou de novo.
      update: {},
    });
  },

  markAttemptStarted: (id: string) =>
    prisma.inferenceRequest.update({
      where: { id },
      data: { attemptCount: { increment: 1 }, lastAttemptAt: new Date() },
    }),

  markSucceeded: (id: string, predictionId: string) =>
    prisma.inferenceRequest.update({
      where: { id },
      data: { status: "SUCCEEDED", predictionId, lastErrorCode: null, lastErrorMessage: null },
    }),

  markFailed: (id: string, errorCode: string, errorMessage: string) =>
    prisma.inferenceRequest.update({
      where: { id },
      data: { status: "FAILED", lastErrorCode: errorCode, lastErrorMessage: errorMessage },
    }),

  /** Reabre uma requisição FAILED para ser reprocessada — só usado por retry explícito, nunca automático em loop. */
  resetToPending: (id: string) => prisma.inferenceRequest.update({ where: { id }, data: { status: "PENDING" } }),

  findPendingBatch: (limit: number) =>
    prisma.inferenceRequest.findMany({
      where: { status: "PENDING" },
      // A leitura mais recente tem prioridade operacional: é ela que define
      // o risco atual exibido no monitoramento. O histórico é drenado depois.
      orderBy: [
        { thermalReading: { measuredAt: "desc" } },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit,
      include: { thermalReading: true, thermalPoint: { include: { component: true } } },
    }),

  countByStatus: (status: InferenceRequestStatus) => prisma.inferenceRequest.count({ where: { status } }),

  async recentAttempts(sinceMinutesAgo: number, sampleLimit: number) {
    const since = new Date(Date.now() - sinceMinutesAgo * 60_000);
    return prisma.inferenceRequest.findMany({
      where: { lastAttemptAt: { gte: since } },
      orderBy: { lastAttemptAt: "desc" },
      take: sampleLimit,
      select: { status: true },
    });
  },

  create: (data: Prisma.InferenceRequestUncheckedCreateInput) => prisma.inferenceRequest.create({ data }),
};
