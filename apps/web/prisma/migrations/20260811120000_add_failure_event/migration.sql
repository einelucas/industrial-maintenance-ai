-- CreateTable
CREATE TABLE "failure_events" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "workOrderId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failure_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "failure_events_equipmentId_idx" ON "failure_events"("equipmentId");

-- CreateIndex
CREATE INDEX "failure_events_occurredAt_idx" ON "failure_events"("occurredAt");

-- AddForeignKey
ALTER TABLE "failure_events" ADD CONSTRAINT "failure_events_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_events" ADD CONSTRAINT "failure_events_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_events" ADD CONSTRAINT "failure_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
