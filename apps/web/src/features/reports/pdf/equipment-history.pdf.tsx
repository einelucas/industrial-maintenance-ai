import { Document, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReportHeader, ReportPage, Badge, styles } from "@/features/reports/pdf/layout";
import { WORK_ORDER_STATUS_LABEL, WORK_ORDER_TYPE_LABEL, RISK_LABEL, EQUIPMENT_STATUS_LABEL, riskColor } from "@/features/reports/pdf/theme";
import type { Equipment, MaintenancePlan, Prediction, Sector, SensorReading, WorkOrder, User } from "@prisma/client";

function fmt(date: Date | null | undefined) {
  return date ? format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";
}

type Props = {
  equipment: Equipment & { sector: Sector };
  workOrders: (WorkOrder & { assignedUser: User | null })[];
  plans: MaintenancePlan[];
  readings: SensorReading[];
  predictions: Prediction[];
};

export function EquipmentHistoryDocument({ equipment, workOrders, plans, readings, predictions }: Props) {
  return (
    <Document title={`Histórico — ${equipment.tag}`}>
      <ReportPage>
        <ReportHeader title={`Histórico do equipamento — ${equipment.tag}`} subtitle={equipment.name} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados gerais</Text>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Setor</Text>
            <Text style={styles.kvValue}>{equipment.sector.name}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Categoria</Text>
            <Text style={styles.kvValue}>{equipment.category}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Status</Text>
            <Text style={styles.kvValue}>{EQUIPMENT_STATUS_LABEL[equipment.status] ?? equipment.status}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Criticidade</Text>
            <Text style={styles.kvValue}>{equipment.criticality}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ordens de serviço ({workOrders.length})</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Número</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Tipo</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Status</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Responsável</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Criada em</Text>
            </View>
            {workOrders.length === 0 && (
              <View style={styles.tableRowLast}><Text style={[styles.tableCell, { flex: 8.5 }]}>Nenhuma OS registrada.</Text></View>
            )}
            {workOrders.map((wo, i) => (
              <View key={wo.id} style={i === workOrders.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{wo.number}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{WORK_ORDER_TYPE_LABEL[wo.type] ?? wo.type}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{WORK_ORDER_STATUS_LABEL[wo.status] ?? wo.status}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{wo.assignedUser?.name ?? "—"}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{fmt(wo.createdAt)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Planos preventivos ({plans.length})</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Nome</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Frequência</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Próxima execução</Text>
            </View>
            {plans.length === 0 && (
              <View style={styles.tableRowLast}><Text style={[styles.tableCell, { flex: 7 }]}>Nenhum plano preventivo.</Text></View>
            )}
            {plans.map((plan, i) => (
              <View key={plan.id} style={i === plans.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 3 }]}>{plan.name}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{plan.frequencyType}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{fmt(plan.nextExecution)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimas predições ({predictions.length})</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Data</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Probabilidade</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Risco</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Modelo</Text>
            </View>
            {predictions.length === 0 && (
              <View style={styles.tableRowLast}><Text style={[styles.tableCell, { flex: 7 }]}>Nenhuma predição registrada.</Text></View>
            )}
            {predictions.slice(0, 30).map((p, i) => (
              <View key={p.id} style={i === Math.min(predictions.length, 30) - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{fmt(p.createdAt)}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{(p.failureProbability * 100).toFixed(1)}%</Text>
                <View style={[styles.tableCell, { flex: 1.5 }]}>
                  <Badge label={RISK_LABEL[p.riskLevel] ?? p.riskLevel} color={riskColor(p.riskLevel)} />
                </View>
                <Text style={[styles.tableCell, { flex: 2 }]}>{p.modelVersion}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimas medições ({readings.length})</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Data</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Temp.</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Vibração</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Pressão</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>RPM</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Origem</Text>
            </View>
            {readings.length === 0 && (
              <View style={styles.tableRowLast}><Text style={[styles.tableCell, { flex: 7.5 }]}>Nenhuma medição registrada.</Text></View>
            )}
            {readings.slice(0, 30).map((r, i) => (
              <View key={r.id} style={i === Math.min(readings.length, 30) - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{fmt(r.measuredAt)}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{r.temperature ?? "—"}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{r.vibration ?? "—"}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{r.pressure ?? "—"}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{r.rpm ?? "—"}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{r.source}</Text>
              </View>
            ))}
          </View>
        </View>
      </ReportPage>
    </Document>
  );
}
