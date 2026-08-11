import { startOfMonth, endOfMonth } from "date-fns";
import { workOrderRepository } from "@/features/work-orders/repositories/work-order.repository";
import { equipmentService } from "@/features/equipments/services/equipment.service";
import { maintenancePlanRepository } from "@/features/maintenance-plans/repositories/maintenance-plan.repository";
import { sensorReadingRepository } from "@/features/sensor-readings/repositories/sensor-reading.repository";
import { predictionRepository } from "@/features/predictions/repositories/prediction.repository";
import { isWorkOrderDelayed } from "@/features/work-orders/services/work-order-delay.service";
import { dashboardService } from "@/features/dashboard/services/dashboard.service";
import type { RiskLevel } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";

export const reportsService = {
  async getWorkOrderReport(id: string) {
    const workOrder = await workOrderRepository.findById(id);
    if (!workOrder) throw new NotFoundError("Ordem de serviço", id);
    return workOrder;
  },

  async getEquipmentHistoryReport(equipmentId: string) {
    const equipment = await equipmentService.getOrThrow(equipmentId);
    const [workOrders, plans, readings, predictions] = await Promise.all([
      workOrderRepository.findByEquipment(equipment.id),
      maintenancePlanRepository.findByEquipment(equipment.id),
      sensorReadingRepository.findByEquipment(equipment.id, 30),
      predictionRepository.findByEquipment(equipment.id, 30),
    ]);
    return { equipment, workOrders, plans, readings, predictions };
  },

  async getOrdersByPeriodReport(start: Date, end: Date) {
    const workOrders = await workOrderRepository.findByDateRange(start, end);
    return { start, end, workOrders };
  },

  async getOverdueOrdersReport() {
    const workOrders = await workOrderRepository.findOpenWithSchedule();
    const now = new Date();
    const overdue = workOrders
      .filter((wo) => isWorkOrderDelayed(wo.scheduledEnd, wo.status, now))
      .sort((a, b) => (a.scheduledEnd?.getTime() ?? 0) - (b.scheduledEnd?.getTime() ?? 0));
    return { workOrders: overdue, now };
  },

  async getMonthlySummaryReport(monthDate: Date) {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const [summary, byStatus, topEquipments, riskDistribution] = await Promise.all([
      dashboardService.getSummaryCards(),
      dashboardService.getWorkOrdersByStatus(),
      dashboardService.getTopEquipmentsByInterventions(),
      dashboardService.getRiskDistribution(),
    ]);
    return { start, end, summary, byStatus, topEquipments, riskDistribution };
  },

  async getPredictiveReport(start: Date, end: Date, riskLevel?: RiskLevel) {
    const predictions = await predictionRepository.findByPeriod(start, end, riskLevel);
    return { start, end, riskLevel, predictions };
  },
};
