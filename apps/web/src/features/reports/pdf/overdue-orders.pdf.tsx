import { Document, Text, View } from "@react-pdf/renderer";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReportHeader, ReportPage, styles } from "@/features/reports/pdf/layout";
import { WORK_ORDER_STATUS_LABEL, PRIORITY_LABEL } from "@/features/reports/pdf/theme";
import type { Equipment, User, WorkOrder } from "@prisma/client";

function fmt(date: Date | null | undefined) {
  return date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "—";
}

type Props = {
  workOrders: (WorkOrder & { equipment: Equipment; assignedUser: User | null })[];
  now?: Date;
};

export function OverdueOrdersDocument({ workOrders, now = new Date() }: Props) {
  return (
    <Document title="Ordens de serviço atrasadas">
      <ReportPage>
        <ReportHeader title="Ordens de serviço atrasadas" subtitle={`${workOrders.length} ordem(ns) em atraso em ${format(now, "dd/MM/yyyy", { locale: ptBR })}`} />

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Número</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Equipamento</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Título</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Prioridade</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Status</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Responsável</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Prevista p/</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Dias atraso</Text>
          </View>
          {workOrders.length === 0 && (
            <View style={styles.tableRowLast}><Text style={[styles.tableCell, { flex: 11.7 }]}>Nenhuma OS em atraso.</Text></View>
          )}
          {workOrders.map((wo, i) => (
            <View key={wo.id} style={i === workOrders.length - 1 ? styles.tableRowLast : styles.tableRow} wrap={false}>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>{wo.number}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{wo.equipment.tag}</Text>
              <Text style={[styles.tableCell, { flex: 2.5 }]}>{wo.title}</Text>
              <Text style={[styles.tableCell, { flex: 1.3 }]}>{PRIORITY_LABEL[wo.priority] ?? wo.priority}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{WORK_ORDER_STATUS_LABEL[wo.status] ?? wo.status}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{wo.assignedUser?.name ?? "—"}</Text>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>{fmt(wo.scheduledEnd)}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>
                {wo.scheduledEnd ? differenceInCalendarDays(now, wo.scheduledEnd) : "—"}
              </Text>
            </View>
          ))}
        </View>
      </ReportPage>
    </Document>
  );
}
