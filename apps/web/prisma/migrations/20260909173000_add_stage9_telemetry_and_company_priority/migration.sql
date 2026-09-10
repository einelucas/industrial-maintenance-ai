-- Etapa 9 — prioridade empresarial, inspeção histórica, telemetria e fila durável.
-- Migration estritamente aditiva: nenhum dado ou coluna existente é removido.

CREATE TYPE "CompanyThermalPriority" AS ENUM ('P5', 'P10', 'P20', 'P30', 'P50', 'P100');
CREATE TYPE "ThermalPriorityPolicyStatus" AS ENUM ('DEMO_DRAFT', 'COMPANY_VALIDATED', 'RETIRED');
CREATE TYPE "DeviceTechnicalAlertType" AS ENUM ('OFFLINE', 'DEGRADED');
CREATE TYPE "DeviceTechnicalAlertStatus" AS ENUM ('OPEN', 'RESOLVED');

ALTER TABLE "work_orders"
  ADD COLUMN "companyPriority" "CompanyThermalPriority",
  ADD COLUMN "priorityPolicyVersion" TEXT;

ALTER TABLE "predictions"
  ADD COLUMN "recommendedCompanyPriority" "CompanyThermalPriority",
  ADD COLUMN "priorityPolicyVersion" TEXT;

ALTER TABLE "alerts"
  ADD COLUMN "companyPriority" "CompanyThermalPriority",
  ADD COLUMN "priorityPolicyVersion" TEXT;

ALTER TABLE "thermal_incidents"
  ADD COLUMN "recommendedCompanyPriority" "CompanyThermalPriority",
  ADD COLUMN "finalCompanyPriority" "CompanyThermalPriority",
  ADD COLUMN "priorityPolicyVersion" TEXT;

ALTER TABLE "human_reviews"
  ADD COLUMN "recommendedCompanyPriority" "CompanyThermalPriority",
  ADD COLUMN "finalCompanyPriority" "CompanyThermalPriority",
  ADD COLUMN "priorityPolicyVersion" TEXT;

ALTER TABLE "sensor_devices"
  ADD COLUMN "credentialVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "credentialRotatedAt" TIMESTAMP(3),
  ADD COLUMN "lastAuthFailureAt" TIMESTAMP(3),
  ADD COLUMN "consecutiveAuthFailures" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "inference_requests"
  ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "lockToken" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "recoveryCount" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "inference_requests_status_idx";
CREATE INDEX "inference_requests_status_availableAt_idx" ON "inference_requests"("status", "availableAt");

CREATE TABLE "thermal_priority_policies" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "ThermalPriorityPolicyStatus" NOT NULL DEFAULT 'DEMO_DRAFT',
  "definitions" JSONB NOT NULL,
  "riskMapping" JSONB NOT NULL,
  "validatedLevels" "CompanyThermalPriority"[] NOT NULL,
  "notes" TEXT,
  "validatedAt" TIMESTAMP(3),
  "validatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "thermal_priority_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thermal_priority_policies_version_key" ON "thermal_priority_policies"("version");
CREATE INDEX "thermal_priority_policies_status_idx" ON "thermal_priority_policies"("status");

CREATE TABLE "thermal_inspections" (
  "id" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "inspectedAt" TIMESTAMP(3) NOT NULL,
  "technicianName" TEXT,
  "notes" TEXT,
  "immutable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "thermal_inspections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thermal_inspections_sourceReference_key" ON "thermal_inspections"("sourceReference");
CREATE INDEX "thermal_inspections_inspectedAt_idx" ON "thermal_inspections"("inspectedAt");

CREATE TABLE "thermal_inspection_findings" (
  "id" TEXT NOT NULL,
  "inspectionId" TEXT NOT NULL,
  "thermalPointId" TEXT NOT NULL,
  "thermalReadingId" TEXT,
  "sourcePriorityLabel" TEXT NOT NULL,
  "companyPriority" "CompanyThermalPriority" NOT NULL,
  "temperatureMaxC" DOUBLE PRECISION,
  "referenceTemperatureC" DOUBLE PRECISION,
  "deltaTC" DOUBLE PRECISION,
  "recommendation" TEXT,
  "observedCause" "ThermalCause",
  "historicalBaseline" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "thermal_inspection_findings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thermal_inspection_findings_inspectionId_thermalPointId_key"
  ON "thermal_inspection_findings"("inspectionId", "thermalPointId");
CREATE INDEX "thermal_inspection_findings_thermalPointId_createdAt_idx"
  ON "thermal_inspection_findings"("thermalPointId", "createdAt");
CREATE INDEX "thermal_inspection_findings_companyPriority_idx"
  ON "thermal_inspection_findings"("companyPriority");

ALTER TABLE "thermal_inspection_findings"
  ADD CONSTRAINT "thermal_inspection_findings_inspectionId_fkey"
  FOREIGN KEY ("inspectionId") REFERENCES "thermal_inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "thermal_inspection_findings_thermalPointId_fkey"
  FOREIGN KEY ("thermalPointId") REFERENCES "thermal_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "thermal_inspection_findings_thermalReadingId_fkey"
  FOREIGN KEY ("thermalReadingId") REFERENCES "thermal_readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "device_telemetry_requests" (
  "id" TEXT NOT NULL,
  "sensorDeviceId" TEXT,
  "identifierHash" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "reasonCode" TEXT,
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "acceptedCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_telemetry_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "device_telemetry_requests_identifierHash_createdAt_idx"
  ON "device_telemetry_requests"("identifierHash", "createdAt");
CREATE INDEX "device_telemetry_requests_sensorDeviceId_createdAt_idx"
  ON "device_telemetry_requests"("sensorDeviceId", "createdAt");
ALTER TABLE "device_telemetry_requests"
  ADD CONSTRAINT "device_telemetry_requests_sensorDeviceId_fkey"
  FOREIGN KEY ("sensorDeviceId") REFERENCES "sensor_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "device_technical_alerts" (
  "id" TEXT NOT NULL,
  "sensorDeviceId" TEXT NOT NULL,
  "type" "DeviceTechnicalAlertType" NOT NULL,
  "status" "DeviceTechnicalAlertStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "device_technical_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "device_technical_alerts_sensorDeviceId_status_idx"
  ON "device_technical_alerts"("sensorDeviceId", "status");
CREATE INDEX "device_technical_alerts_status_type_idx"
  ON "device_technical_alerts"("status", "type");
ALTER TABLE "device_technical_alerts"
  ADD CONSTRAINT "device_technical_alerts_sensorDeviceId_fkey"
  FOREIGN KEY ("sensorDeviceId") REFERENCES "sensor_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Barreiras de banco para que a inspeção original não seja alterada ou
-- removida acidentalmente depois de publicada.
CREATE OR REPLACE FUNCTION prevent_immutable_thermal_inspection_change()
RETURNS trigger AS $$
BEGIN
  IF OLD."immutable" THEN
    RAISE EXCEPTION 'Immutable thermal inspection cannot be changed';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "thermal_inspections_immutable_update"
BEFORE UPDATE OR DELETE ON "thermal_inspections"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_thermal_inspection_change();

CREATE OR REPLACE FUNCTION prevent_immutable_thermal_finding_change()
RETURNS trigger AS $$
DECLARE parent_immutable BOOLEAN;
BEGIN
  SELECT "immutable" INTO parent_immutable
  FROM "thermal_inspections" WHERE "id" = OLD."inspectionId";
  IF parent_immutable THEN
    RAISE EXCEPTION 'Finding of immutable thermal inspection cannot be changed';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "thermal_inspection_findings_immutable_update"
BEFORE UPDATE OR DELETE ON "thermal_inspection_findings"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_thermal_finding_change();
