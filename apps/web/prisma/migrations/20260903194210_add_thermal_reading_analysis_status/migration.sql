-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING_AI', 'ANALYZED', 'AI_FAILED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "thermal_readings" ADD COLUMN     "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING_AI';

-- CreateIndex
CREATE INDEX "thermal_readings_analysisStatus_measuredAt_idx" ON "thermal_readings"("analysisStatus", "measuredAt");

