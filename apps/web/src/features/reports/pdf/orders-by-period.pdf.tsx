import { Document, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReportHeader, ReportPage, styles } from "@/features/reports/pdf/layout";
import { WORK_ORDER_STATUS_LABEL, WORK_ORDER_TYPE_LABEL } from "@/features/reports/pdf/theme";
import type { Equipment, User, WorkOrder } from "@prisma/client";

function fmt(date: Date | null | undefined) {
  return date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "—";
}

type Props = {
  start: Date;
  end: Date;
  workOrders: (WorkOrder & { equipment: Equipment; assignedUser: User | null })[];
};

export function OrdersByPeriodDocument({ start, end, workOrders }: Props) {
  return (
    <Document title="Ordens de serviço por período">
      <ReportPage>
        <ReportHeader
          title="Ordens de serviço por período"
          subtitle={`${format(start, "dd/MM/yyyy", { locale: ptBR })} até ${format(end, "dd/MM/yyyy", { locale: ptBR })} — ${workOrders.length} ordem(ns)`}
        />

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Número</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Equipamento</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Título</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Tipo</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Status</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Responsável</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Criada em</Text>
          </View>
          {workOrders.length === 0 && (
            <View style={styles.tableRowLast}><Text style={[styles.tableCell, { flex: 10.7 }]}>Nenhuma OS criada no período.</Text></View>
          )}
          {workOrders.map((wo, i) => (
            <View key={wo.id} style={i === workOrders.length - 1 ? styles.tableRowLast : styles.tableRow} wrap={false}>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>{wo.number}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{wo.equipment.tag}</Text>
              <Text style={[styles.tableCell, { flex: 2.5 }]}>{wo.title}</Text>
              <Text style={[styles.tableCell, { flex: 1.3 }]}>{WORK_ORDER_TYPE_LABEL[wo.type] ?? wo.type}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{WORK_ORDER_STATUS_LABEL[wo.status] ?? wo.status}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{wo.assignedUser?.name ?? "—"}</Text>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>{fmt(wo.createdAt)}</Text>
            </View>
          ))}
        </View>
      </ReportPage>
    </Document>
  );
}
