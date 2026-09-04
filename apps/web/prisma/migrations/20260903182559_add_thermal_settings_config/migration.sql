-- CreateTable
CREATE TABLE "thermal_global_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "absoluteLimitC" DOUBLE PRECISION NOT NULL,
    "deltaTAttentionC" DOUBLE PRECISION NOT NULL,
    "deltaTHighC" DOUBLE PRECISION NOT NULL,
    "deltaTCriticalC" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "thermal_global_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thermal_component_type_configs" (
    "id" TEXT NOT NULL,
    "componentType" "ElectricalComponentType" NOT NULL,
    "absoluteLimitC" DOUBLE PRECISION,
    "deltaTAttentionC" DOUBLE PRECISION,
    "deltaTHighC" DOUBLE PRECISION,
    "deltaTCriticalC" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "thermal_component_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "thermal_component_type_configs_componentType_key" ON "thermal_component_type_configs"("componentType");

