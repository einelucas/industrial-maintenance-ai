import { prisma } from "@/lib/db/client";
import type { Prisma, InferenceRequestStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";

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
      data: { status: "SUCCEEDED", predictionId, lastErrorCode: null, lastErrorMessage: null, completedAt: new Date(), lockedAt: null, leaseExpiresAt: null, lockToken: null },
    }),

  markFailed: (id: string, errorCode: string, errorMessage: string) =>
    prisma.inferenceRequest.update({
      where: { id },
      data: { status: "FAILED", lastErrorCode: errorCode, lastErrorMessage: errorMessage, completedAt: new Date(), lockedAt: null, leaseExpiresAt: null, lockToken: null },
    }),

  /** Reabre uma requisição FAILED para ser reprocessada — só usado por retry explícito, nunca automático em loop. */
  resetToPending: (id: string) => prisma.inferenceRequest.update({ where: { id }, data: { status: "PENDING", availableAt: new Date(), completedAt: null, lockedAt: null, leaseExpiresAt: null, lockToken: null } }),

  async claimBatch(limit: number, leaseSeconds = 55) {
    const lockToken = randomUUID();
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000);
    const rows = await prisma.$queryRaw<Array<{ inferenceRequestId: string }>>`
      WITH candidates AS (
        SELECT ir."id"
        FROM "inference_requests" ir
        INNER JOIN "thermal_readings" tr ON tr."id" = ir."thermalReadingId"
        WHERE ir."status" = 'PENDING'::"InferenceRequestStatus"
          AND ir."availableAt" <= ${now}
          AND (ir."leaseExpiresAt" IS NULL OR ir."leaseExpiresAt" < ${now})
        ORDER BY tr."measuredAt" DESC, ir."createdAt" DESC
        FOR UPDATE OF ir SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "inference_requests" ir
      SET "lockedAt" = ${now}, "leaseExpiresAt" = ${leaseExpiresAt}, "lockToken" = ${lockToken}, "updatedAt" = ${now}
      FROM candidates
      WHERE ir."id" = candidates."id"
      RETURNING ir."inferenceRequestId"
    `;
    return { lockToken, inferenceRequestIds: rows.map((row) => row.inferenceRequestId) };
  },

  async scheduleRetry(inferenceRequestId: string, lockToken: string) {
    const current = await prisma.inferenceRequest.findUnique({ where: { inferenceRequestId }, select: { attemptCount: true } });
    if (!current) return;
    const delaySeconds = Math.min(300, 5 * 2 ** Math.max(0, current.attemptCount - 1));
    await prisma.inferenceRequest.updateMany({
      where: { inferenceRequestId, status: "PENDING", lockToken },
      data: {
        availableAt: new Date(Date.now() + delaySeconds * 1000),
        lockedAt: null,
        leaseExpiresAt: null,
        lockToken: null,
      },
    });
  },

  releaseLease: (inferenceRequestId: string, lockToken: string) =>
    prisma.inferenceRequest.updateMany({
      where: { inferenceRequestId, lockToken },
      data: { lockedAt: null, leaseExpiresAt: null, lockToken: null },
    }),

  releaseExpiredLeases: (now = new Date()) =>
    prisma.inferenceRequest.updateMany({
      where: { status: "PENDING", leaseExpiresAt: { lt: now } },
      data: { lockedAt: null, leaseExpiresAt: null, lockToken: null, availableAt: now },
    }),

  async recoverTransientFailures(maxRecoveries = 3, now = new Date()) {
    const retryableBefore = new Date(now.getTime() - 60 * 60 * 1000);
    const recoverable = await prisma.inferenceRequest.findMany({
      where: {
        status: "FAILED",
        recoveryCount: { lt: maxRecoveries },
        completedAt: { lt: retryableBefore },
        lastErrorCode: { in: ["NOT_READY", "NETWORK_ERROR", "TIMEOUT"] },
      },
      select: { id: true, thermalReadingId: true },
      take: 500,
    });
    if (!recoverable.length) return 0;
    await prisma.$transaction([
      prisma.inferenceRequest.updateMany({
        where: { id: { in: recoverable.map((request) => request.id) }, status: "FAILED" },
        data: {
          status: "PENDING",
          attemptCount: 0,
          recoveryCount: { increment: 1 },
          availableAt: now,
          completedAt: null,
          lockedAt: null,
          leaseExpiresAt: null,
          lockToken: null,
        },
      }),
      prisma.thermalReading.updateMany({
        where: { id: { in: recoverable.map((request) => request.thermalReadingId) }, analysisStatus: "AI_FAILED" },
        data: { analysisStatus: "PENDING_AI" },
      }),
    ]);
    return recoverable.length;
  },

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
