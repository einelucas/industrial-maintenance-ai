-- Suporta a limpeza diária configurável do log técnico de requisições.
CREATE INDEX "device_telemetry_requests_createdAt_idx"
  ON "device_telemetry_requests"("createdAt");
