import type { WorkOrderStatus } from "@prisma/client";

const NON_DELAYABLE_STATUSES: WorkOrderStatus[] = ["COMPLETED", "CANCELED"];

/**
 * Única função do sistema que decide se uma OS está atrasada (seção 28):
 * scheduledEnd < agora E status não é COMPLETED/CANCELED.
 */
export function isWorkOrderDelayed(
  scheduledEnd: Date | null,
  status: WorkOrderStatus,
  now: Date = new Date()
): boolean {
  if (!scheduledEnd) return false;
  if (NON_DELAYABLE_STATUSES.includes(status)) return false;
  return scheduledEnd.getTime() < now.getTime();
}
