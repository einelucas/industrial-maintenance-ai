-- CreateEnum
CREATE TYPE "PanelType" AS ENUM ('MCC', 'DISTRIBUTION', 'CONTROL', 'PROTECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ElectricalComponentType" AS ENUM ('CIRCUIT_BREAKER', 'CONTACTOR', 'THERMAL_RELAY', 'TERMINAL', 'BUSBAR', 'FUSE', 'CABLE_CONNECTION', 'POWER_SUPPLY', 'DRIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "MonitoringMode" AS ENUM ('MANUAL', 'CSV', 'SIMULATOR', 'POINT_SENSOR', 'THERMAL_ARRAY', 'THERMAL_CAMERA');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('PROVISIONING', 'ONLINE', 'OFFLINE', 'DEGRADED', 'MAINTENANCE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ModelStage" AS ENUM ('RULE_ONLY', 'SYNTHETIC_EXPERIMENTAL', 'PLANT_CALIBRATION', 'PLANT_VALIDATED');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'UNDER_ANALYSIS', 'WORK_ORDER_CREATED', 'MONITORING_AFTER_ACTION', 'NORMALIZED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ThermalCause" AS ENUM ('LOOSE_CONNECTION', 'CONTACT_RESISTANCE', 'OVERLOAD', 'PHASE_IMBALANCE', 'DEGRADED_CONTACT', 'INSUFFICIENT_VENTILATION', 'THERMAL_RELAY_DEGRADATION', 'PROCESS_CONDITION', 'SENSOR_ERROR', 'NOT_CONFIRMED', 'OTHER');

-- AlterTable
ALTER TABLE "predictions" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "explanations" JSONB,
ADD COLUMN     "modelScore" DOUBLE PRECISION,
ADD COLUMN     "modelStage" "ModelStage",
ADD COLUMN     "predictionHorizonH" INTEGER,
ADD COLUMN     "recommendedAction" TEXT,
ADD COLUMN     "riskScore" DOUBLE PRECISION,
ADD COLUMN     "ruleScore" DOUBLE PRECISION,
ADD COLUMN     "thermalPointId" TEXT,
ADD COLUMN     "thermalReadingId" TEXT,
ADD COLUMN     "timeAboveLimitMin" DOUBLE PRECISION,
ADD COLUMN     "trendCPerHour" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "firstTriggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastTriggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "peakDeltaTC" DOUBLE PRECISION,
ADD COLUMN     "peakTemperatureC" DOUBLE PRECISION,
ADD COLUMN     "thermalIncidentId" TEXT,
ADD COLUMN     "triggerCount" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "electrical_panels" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "panelType" "PanelType" NOT NULL,
    "sectorId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "electrical_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitored_components" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "componentType" "ElectricalComponentType" NOT NULL,
    "phase" TEXT,
    "ratedCurrent" DOUBLE PRECISION,
    "manufacturer" TEXT,
    "model" TEXT,
    "panelId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitored_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thermal_points" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "monitoringMode" "MonitoringMode" NOT NULL,
    "emissivity" DOUBLE PRECISION,
    "referenceDescription" TEXT,
    "absoluteLimitC" DOUBLE PRECISION,
    "deltaTAttentionC" DOUBLE PRECISION,
    "deltaTHighC" DOUBLE PRECISION,
    "deltaTCriticalC" DOUBLE PRECISION,
    "sampleIntervalSec" INTEGER NOT NULL DEFAULT 60,
    "initiallyAnomalous" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thermal_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_devices" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "firmwareVersion" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PROVISIONING',
    "thermalPointId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "lastSequence" BIGINT,
    "calibrationDate" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "apiKeyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensor_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thermal_readings" (
    "id" TEXT NOT NULL,
    "thermalPointId" TEXT NOT NULL,
    "sensorDeviceId" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" BIGINT,
    "temperatureMaxC" DOUBLE PRECISION NOT NULL,
    "temperatureAverageC" DOUBLE PRECISION,
    "ambientTemperatureC" DOUBLE PRECISION,
    "referenceTemperatureC" DOUBLE PRECISION,
    "deltaTC" DOUBLE PRECISION,
    "currentA" DOUBLE PRECISION,
    "loadPercent" DOUBLE PRECISION,
    "emissivity" DOUBLE PRECISION,
    "signalQuality" DOUBLE PRECISION,
    "source" "MonitoringMode" NOT NULL,
    "rawPayload" JSONB,

    CONSTRAINT "thermal_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thermograms" (
    "id" TEXT NOT NULL,
    "thermalReadingId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "minTemperatureC" DOUBLE PRECISION,
    "maxTemperatureC" DOUBLE PRECISION,
    "roi" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thermograms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thermal_incidents" (
    "id" TEXT NOT NULL,
    "thermalPointId" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "AlertSeverity" NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "normalizedAt" TIMESTAMP(3),
    "peakTemperatureC" DOUBLE PRECISION NOT NULL,
    "peakDeltaTC" DOUBLE PRECISION,
    "lastRiskScore" DOUBLE PRECISION NOT NULL,
    "cause" "ThermalCause" NOT NULL DEFAULT 'NOT_CONFIRMED',
    "diagnosis" TEXT,
    "recommendation" TEXT,
    "workOrderId" TEXT,
    "acknowledgedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thermal_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "electrical_panels_tag_key" ON "electrical_panels"("tag");

-- CreateIndex
CREATE INDEX "electrical_panels_sectorId_idx" ON "electrical_panels"("sectorId");

-- CreateIndex
CREATE INDEX "electrical_panels_equipmentId_idx" ON "electrical_panels"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "monitored_components_tag_key" ON "monitored_components"("tag");

-- CreateIndex
CREATE INDEX "monitored_components_panelId_idx" ON "monitored_components"("panelId");

-- CreateIndex
CREATE UNIQUE INDEX "thermal_points_code_key" ON "thermal_points"("code");

-- CreateIndex
CREATE INDEX "thermal_points_componentId_idx" ON "thermal_points"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "sensor_devices_serialNumber_key" ON "sensor_devices"("serialNumber");

-- CreateIndex
CREATE INDEX "sensor_devices_thermalPointId_idx" ON "sensor_devices"("thermalPointId");

-- CreateIndex
CREATE INDEX "sensor_devices_status_lastSeenAt_idx" ON "sensor_devices"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "thermal_readings_thermalPointId_measuredAt_idx" ON "thermal_readings"("thermalPointId", "measuredAt");

-- CreateIndex
CREATE INDEX "thermal_readings_measuredAt_idx" ON "thermal_readings"("measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "thermal_readings_sensorDeviceId_sequence_key" ON "thermal_readings"("sensorDeviceId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "thermograms_thermalReadingId_key" ON "thermograms"("thermalReadingId");

-- CreateIndex
CREATE UNIQUE INDEX "thermal_incidents_workOrderId_key" ON "thermal_incidents"("workOrderId");

-- CreateIndex
CREATE INDEX "thermal_incidents_thermalPointId_status_idx" ON "thermal_incidents"("thermalPointId", "status");

-- CreateIndex
CREATE INDEX "thermal_incidents_severity_status_idx" ON "thermal_incidents"("severity", "status");

-- CreateIndex
CREATE INDEX "predictions_thermalPointId_idx" ON "predictions"("thermalPointId");

-- CreateIndex
CREATE INDEX "predictions_thermalReadingId_idx" ON "predictions"("thermalReadingId");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_thermalIncidentId_key" ON "alerts"("thermalIncidentId");

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_thermalPointId_fkey" FOREIGN KEY ("thermalPointId") REFERENCES "thermal_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_thermalReadingId_fkey" FOREIGN KEY ("thermalReadingId") REFERENCES "thermal_readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_thermalIncidentId_fkey" FOREIGN KEY ("thermalIncidentId") REFERENCES "thermal_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electrical_panels" ADD CONSTRAINT "electrical_panels_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electrical_panels" ADD CONSTRAINT "electrical_panels_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitored_components" ADD CONSTRAINT "monitored_components_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "electrical_panels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thermal_points" ADD CONSTRAINT "thermal_points_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "monitored_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_devices" ADD CONSTRAINT "sensor_devices_thermalPointId_fkey" FOREIGN KEY ("thermalPointId") REFERENCES "thermal_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thermal_readings" ADD CONSTRAINT "thermal_readings_thermalPointId_fkey" FOREIGN KEY ("thermalPointId") REFERENCES "thermal_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thermal_readings" ADD CONSTRAINT "thermal_readings_sensorDeviceId_fkey" FOREIGN KEY ("sensorDeviceId") REFERENCES "sensor_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thermograms" ADD CONSTRAINT "thermograms_thermalReadingId_fkey" FOREIGN KEY ("thermalReadingId") REFERENCES "thermal_readings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thermal_incidents" ADD CONSTRAINT "thermal_incidents_thermalPointId_fkey" FOREIGN KEY ("thermalPointId") REFERENCES "thermal_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thermal_incidents" ADD CONSTRAINT "thermal_incidents_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thermal_incidents" ADD CONSTRAINT "thermal_incidents_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

