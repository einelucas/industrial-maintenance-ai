import { Document, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReportHeader, ReportPage, Badge, styles } from "@/features/reports/pdf/layout";
import { WORK_ORDER_STATUS_LABEL, WORK_ORDER_TYPE_LABEL, PRIORITY_LABEL, COLORS } from "@/features/reports/pdf/theme";
import type { workOrderRepository } from "@/features/work-orders/repositories/work-order.repository";

type WorkOrder = NonNullable<Awaited<ReturnType<typeof workOrderRepository.findById>>>;

function fmt(date: Date | null | undefined) {
  return date ? format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";
}

export function WorkOrderReportDocument({ workOrder }: { workOrder: WorkOrder }) {
  return (
    <Document title={`Relatório de OS ${workOrder.number}`}>
      <ReportPage>
        <ReportHeader title={`Ordem de Serviço ${workOrder.number}`} subtitle={workOrder.title} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados gerais</Text>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Status</Text>
            <View style={styles.kvValue}>
              <Badge label={WORK_ORDER_STATUS_LABEL[workOrder.status] ?? workOrder.status} color={COLORS.primary} />
            </View>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Tipo</Text>
            <Text style={styles.kvValue}>{WORK_ORDER_TYPE_LABEL[workOrder.type] ?? workOrder.type}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Prioridade</Text>
            <Text style={styles.kvValue}>{PRIORITY_LABEL[workOrder.priority] ?? workOrder.priority}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Equipamento</Text>
            <Text style={styles.kvValue}>{workOrder.equipment.tag} — {workOrder.equipment.name}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Responsável</Text>
            <Text style={styles.kvValue}>{workOrder.assignedUser?.name ?? "—"}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Criada por</Text>
            <Text style={styles.kvValue}>{workOrder.createdBy.name}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Programada</Text>
            <Text style={styles.kvValue}>{fmt(workOrder.scheduledStart)} até {fmt(workOrder.scheduledEnd)}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Realizada</Text>
            <Text style={styles.kvValue}>{fmt(workOrder.actualStart)} até {fmt(workOrder.actualEnd)}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Horas (est. / real)</Text>
            <Text style={styles.kvValue}>{workOrder.estimatedHours ?? "—"} / {workOrder.actualHours ?? "—"}</Text>
          </View>
        </View>

        {workOrder.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descrição</Text>
            <Text>{workOrder.description}</Text>
          </View>
        )}

        {workOrder.solution && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Solução aplicada</Text>
            <Text>{workOrder.solution}</Text>
          </View>
        )}

        {workOrder.checklistItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Checklist</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Item</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Concluído</Text>
              </View>
              {workOrder.checklistItems.map((item, i) => (
                <View key={item.id} style={i === workOrder.checklistItems.length - 1 ? styles.tableRowLast : styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 3 }]}>{item.description}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{item.completed ? "Sim" : "Não"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Histórico</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Data</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Usuário</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Ação</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Descrição</Text>
            </View>
            {workOrder.history.length === 0 && (
              <View style={styles.tableRowLast}>
                <Text style={[styles.tableCell, { flex: 8 }]}>Nenhum evento registrado.</Text>
              </View>
            )}
            {workOrder.history.map((h, i) => (
              <View key={h.id} style={i === workOrder.history.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1 }]}>{fmt(h.createdAt)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{h.user.name}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{h.action}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{h.description ?? "—"}</Text>
              </View>
            ))}
          </View>
        </View>
      </ReportPage>
    </Document>
  );
}
