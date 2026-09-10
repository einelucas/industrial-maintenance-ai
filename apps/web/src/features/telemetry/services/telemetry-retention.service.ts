import { prisma } from "@/lib/db/client";

function auditRetentionDays(): number {
  const configured = Number(process.env.TELEMETRY_AUDIT_RETENTION_DAYS);
  return Number.isInteger(configured) && configured >= 30 && configured <= 3650 ? configured : 90;
}

export const telemetryRetentionService = {
  async purgeExpiredRequestAudits(now = new Date()) {
    const cutoff = new Date(now.getTime() - auditRetentionDays() * 86_400_000);
    const result = await prisma.deviceTelemetryRequest.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return { deletedCount: result.count, cutoff };
  },
};
