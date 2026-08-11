-- CreateTable
CREATE TABLE "risk_threshold_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "lowMax" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    "moderateMax" DOUBLE PRECISION NOT NULL DEFAULT 0.60,
    "highMax" DOUBLE PRECISION NOT NULL DEFAULT 0.80,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "risk_threshold_configs_pkey" PRIMARY KEY ("id")
);
