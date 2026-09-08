import { prisma } from "@/lib/db/client";
import type { HumanReviewDecision, IncidentStatus } from "@prisma/client";
import { humanReviewDecisionSchema } from "@/features/thermal-incidents/schemas/human-review.schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { predictionEvidenceInclude, predictionOrder, traceablePredictionWhere } from "@/features/thermal-monitoring/repositories/thermal-monitoring.repository";
import { isTraceablePrediction } from "@/features/thermal-monitoring/services/thermal-presentation";

// Revisão humana do defeito indicado pela IA (GPMS 2026 / Etapa 5). Histórico
// imutável: cada chamada cria uma nova linha em `HumanReview` (nunca
// sobrescreve uma anterior) e atualiza só o SNAPSHOT mais recente em
// `ThermalIncident`. O humano nunca altera `modelScore`, checksum, versão
// ou qualquer campo da Prediction original — só registra sua própria decisão
// sobre o incidente.
const NEXT_STATUS_BY_DECISION: Record<HumanReviewDecision, IncidentStatus> = {
  CONFIRMED: "HUMAN_CONFIRMED",
  REJECTED: "HUMAN_REJECTED",
  INCONCLUSIVE: "INCONCLUSIVE",
  NEW_READING_REQUIRED: "NEW_READING_REQUIRED",
};

export const humanReviewService = {
  async submit(input: unknown, reviewerId: string) {
    const parsed = humanReviewDecisionSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados da revisão inválidos.", parsed.error.flatten().fieldErrors);
    }

    // A revisão de evidência já persistida continua permitida sem IA,
    // conforme a Etapa 5. Ela não cria uma inferência nem autoriza uma OS.
    const incident = await prisma.thermalIncident.findUnique({ where: { id: parsed.data.thermalIncidentId }, include: { triggerPrediction: { include: predictionEvidenceInclude } } });
    if (!incident) throw new NotFoundError("Incidente térmico", parsed.data.thermalIncidentId);

    // Defesa em profundidade: `triggerPredictionId` é NOT NULL desde a
    // criação (nenhum incidente nasce sem Prediction), mas confirmamos aqui
    // mesmo assim — nunca revisamos um incidente sem proveniência de IA.
    if (!incident.triggerPredictionId || !incident.triggerPrediction || !isTraceablePrediction(incident.triggerPrediction)) {
      throw new ValidationError("Incidente sem Prediction de origem — não pode ser revisado.");
    }
    if (incident.workOrderId || ["NORMALIZED", "DISMISSED"].includes(incident.status)) {
      throw new ValidationError("Este ciclo já foi encaminhado para manutenção ou encerrado.");
    }

    // A "análise revisada" é sempre a predição mais recente do ponto — o
    // humano avalia o estado atual, não necessariamente a primeira predição
    // que abriu o incidente.
    const latestPrediction = await prisma.prediction.findFirst({
      where: { thermalPointId: incident.thermalPointId, ...traceablePredictionWhere },
      orderBy: predictionOrder,
      include: predictionEvidenceInclude,
    });
    if (!latestPrediction || !isTraceablePrediction(latestPrediction)) {
      throw new ValidationError("Nenhuma predição encontrada para este ponto — não é possível revisar.");
    }
    if (parsed.data.expectedPredictionId && parsed.data.expectedPredictionId !== latestPrediction.id) {
      throw new ValidationError("Uma nova inferência foi registrada. Atualize a página e revise a evidência mais recente.");
    }

    const nextStatus = NEXT_STATUS_BY_DECISION[parsed.data.decision];

    return prisma.$transaction(async (tx) => {
      // O mesmo lock usado pela consolidação da IA protege o estado revisado.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${incident.thermalPointId}))`;
      const current = await tx.thermalIncident.findUnique({ where: { id: incident.id } });
      if (!current || current.workOrderId || current.status !== incident.status || current.updatedAt.getTime() !== incident.updatedAt.getTime()) {
        throw new ValidationError("O incidente foi atualizado. Recarregue a página antes de registrar a decisão.");
      }
      const currentPrediction = await tx.prediction.findFirst({ where: { thermalPointId: incident.thermalPointId, ...traceablePredictionWhere }, orderBy: predictionOrder });
      if (currentPrediction?.id !== latestPrediction.id) {
        throw new ValidationError("Uma nova inferência foi registrada. Recarregue a página para revisar.");
      }
      const updated = await tx.thermalIncident.update({
        where: { id: incident.id },
        data: {
          status: nextStatus,
          humanReviewDecision: parsed.data.decision,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
        },
      });

      await tx.humanReview.create({
        data: {
          thermalIncidentId: incident.id,
          reviewedPredictionId: latestPrediction.id,
          decision: parsed.data.decision,
          justification: parsed.data.justification ?? null,
          previousStatus: incident.status,
          nextStatus,
          reviewedById: reviewerId,
        },
      });

      return updated;
    });
  },
};
