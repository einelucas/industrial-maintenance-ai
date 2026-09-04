-- CreateEnum
CREATE TYPE "HumanReviewDecision" AS ENUM ('CONFIRMED', 'REJECTED', 'INCONCLUSIVE', 'NEW_READING_REQUIRED');

-- CreateEnum
CREATE TYPE "InferenceRequestStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "predictions" DROP CONSTRAINT "predictions_equipmentId_fkey";

-- AlterTable
ALTER TABLE "alerts" ALTER COLUMN "equipmentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "predictions" ADD COLUMN     "failureModeConfidence" DOUBLE PRECISION,
ADD COLUMN     "featureVersion" TEXT,
ADD COLUMN     "inferenceId" TEXT,
ADD COLUMN     "inferenceRequestId" TEXT,
ADD COLUMN     "modelChecksum" TEXT,
ADD COLUMN     "predictedFailureMode" "ThermalCause",
ALTER COLUMN "equipmentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "thermal_incidents" ADD COLUMN     "humanReviewDecision" "HumanReviewDecision",
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "triggerCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "triggerPredictionId" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING_HUMAN_REVIEW';

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "thermalPointId" TEXT;

-- CreateTable
CREATE TABLE "human_reviews" (
    "id" TEXT NOT NULL,
    "thermalIncidentId" TEXT NOT NULL,
    "reviewedPredictionId" TEXT NOT NULL,
    "decision" "HumanReviewDecision" NOT NULL,
    "justification" TEXT,
    "previousStatus" "IncidentStatus" NOT NULL,
    "nextStatus" "IncidentStatus" NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inference_requests" (
    "id" TEXT NOT NULL,
    "inferenceRequestId" TEXT NOT NULL,
    "thermalReadingId" TEXT NOT NULL,
    "thermalPointId" TEXT NOT NULL,
    "featureVersion" TEXT NOT NULL,
    "status" "InferenceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "predictionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inference_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "human_reviews_thermalIncidentId_createdAt_idx" ON "human_reviews"("thermalIncidentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inference_requests_inferenceRequestId_key" ON "inference_requests"("inferenceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "inference_requests_predictionId_key" ON "inference_requests"("predictionId");

-- CreateIndex
CREATE INDEX "inference_requests_status_idx" ON "inference_requests"("status");

-- CreateIndex
CREATE INDEX "inference_requests_thermalPointId_status_idx" ON "inference_requests"("thermalPointId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_inferenceId_key" ON "predictions"("inferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "thermal_incidents_triggerPredictionId_key" ON "thermal_incidents"("triggerPredictionId");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_thermalPointId_fkey" FOREIGN KEY ("thermalPointId") REFERENCES "thermal_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thermal_incidents" ADD CONSTRAINT "thermal_incidents_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thermal_incidents" ADD CONSTRAINT "thermal_incidents_triggerPredictionId_fkey" FOREIGN KEY ("triggerPredictionId") REFERENCES "predictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_thermalIncidentId_fkey" FOREIGN KEY ("thermalIncidentId") REFERENCES "thermal_incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_reviewedPredictionId_fkey" FOREIGN KEY ("reviewedPredictionId") REFERENCES "predictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inference_requests" ADD CONSTRAINT "inference_requests_thermalReadingId_fkey" FOREIGN KEY ("thermalReadingId") REFERENCES "thermal_readings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inference_requests" ADD CONSTRAINT "inference_requests_thermalPointId_fkey" FOREIGN KEY ("thermalPointId") REFERENCES "thermal_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inference_requests" ADD CONSTRAINT "inference_requests_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

