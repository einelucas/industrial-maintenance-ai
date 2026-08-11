-- AlterTable
ALTER TABLE "sensor_readings"
ADD COLUMN "airTemperature" DOUBLE PRECISION,
ADD COLUMN "processTemperature" DOUBLE PRECISION,
ADD COLUMN "toolWear" DOUBLE PRECISION,
ADD COLUMN "rotationalSpeed" DOUBLE PRECISION;
