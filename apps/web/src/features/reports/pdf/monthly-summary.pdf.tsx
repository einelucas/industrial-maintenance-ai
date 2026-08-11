import { Document, Text, View } from "@react-pdf/renderer";
import { ReportHeader, ReportPage, styles } from "@/features/reports/pdf/layout";
import { WORK_ORDER_STATUS_LABEL } from "@/features/reports/pdf/theme";

type SummaryCards = {
  activeEquipments: number;
  openWO: number;
  inProgressWO: number;
  delayedWO: number;
  completedWO: number;
  openAlerts: number;
  highRiskEquipments: number;
};

type Props = {
  monthLabel: string;
  summary: SummaryCards;
  byStatus: { status: string; count: number }[];
  topEquipments: { tag: string; count: number }[];
  riskDistribution: { level: string; count: number }[];
};

const CARD_LABELS: [keyof SummaryCards, string][] = [
  ["activeEquipments", "Equipamentos operacionais"],
  ["openWO", "OS abertas"],
  ["inProgressWO", "OS em andamento"],
  ["delayedWO", "OS atrasadas"],
  ["completedWO", "OS concluídas"],
  ["openAlerts", "Alertas em aberto"],
  ["highRiskEquipments", "Equipamentos em risco alto/crítico"],
];

const RISK_LEVEL_LABEL: Record<string, string> = { LOW: "Baixo", MODERATE: "Moderado", HIGH: "Alto", CRITICAL: "Crítico" };

export function MonthlySummaryDocument({ monthLabel, summary, byStatus, topEquipments, riskDistribution }: Props) {
  return (
    <Document title={`Resumo mensal — ${monthLabel}`}>
      <ReportPage>
        <ReportHeader title="Resumo mensal" subtitle={monthLabel} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indicadores gerais</Text>
          <View style={styles.table}>
            {CARD_LABELS.map(([key, label], i) => (
              <View key={key} style={i === CARD_LABELS.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 3 }]}>{label}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>{summary[key]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Ordens de serviço por status</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Status</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Quantidade</Text>
            </View>
            {byStatus.map((row, i) => (
              <View key={row.status} style={i === byStatus.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 3 }]}>{WORK_ORDER_STATUS_LABEL[row.status] ?? row.status}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>{row.count}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Top 5 equipamentos por número de intervenções</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Equipamento</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Intervenções</Text>
            </View>
            {topEquipments.length === 0 && (
              <View style={styles.tableRowLast}><Text style={[styles.tableCell, { flex: 4 }]}>Sem dados no período.</Text></View>
            )}
            {topEquipments.map((row, i) => (
              <View key={row.tag} style={i === topEquipments.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 3 }]}>{row.tag}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>{row.count}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Distribuição de risco (última predição por equipamento)</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Nível</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Equipamentos</Text>
            </View>
            {riskDistribution.map((row, i) => (
              <View key={row.level} style={i === riskDistribution.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 3 }]}>{RISK_LEVEL_LABEL[row.level] ?? row.level}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>{row.count}</Text>
              </View>
            ))}
          </View>
        </View>
      </ReportPage>
    </Document>
  );
}
