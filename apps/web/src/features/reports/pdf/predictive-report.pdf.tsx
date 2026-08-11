import { Document, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReportHeader, ReportPage, Badge, styles } from "@/features/reports/pdf/layout";
import { RISK_LABEL, riskColor } from "@/features/reports/pdf/theme";
import type { Equipment, Prediction } from "@prisma/client";

function fmt(date: Date | null | undefined) {
  return date ? format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";
}

type Props = {
  start: Date;
  end: Date;
  riskLevel?: string;
  predictions: (Prediction & { equipment: Equipment })[];
};

export function PredictiveReportDocument({ start, end, riskLevel, predictions }: Props) {
  const counts = predictions.reduce<Record<string, number>>((acc, p) => {
    acc[p.riskLevel] = (acc[p.riskLevel] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Document title="Relatório preditivo">
      <ReportPage>
        <ReportHeader
          title="Relatório preditivo"
          subtitle={`${format(start, "dd/MM/yyyy", { locale: ptBR })} até ${format(end, "dd/MM/yyyy", { locale: ptBR })}${riskLevel ? ` — filtro: risco ${RISK_LABEL[riskLevel] ?? riskLevel}` : ""} — ${predictions.length} predição(ões)`}
        />

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Resumo por nível de risco</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Nível</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Predições</Text>
            </View>
            {Object.entries(counts).map(([level, count], i, arr) => (
              <View key={level} style={i === arr.length - 1 ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 3 }]}>{RISK_LABEL[level] ?? level}</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>{count}</Text>
              </View>
            ))}
            {Object.keys(counts).length === 0 && (
              <View style={styles.tableRowLast}><Text style={[styles.tableCell, { flex: 4 }]}>Nenhuma predição no período.</Text></View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Predições e alertas</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Data</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Equipamento</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Probabilidade</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Risco</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Modelo</Text>
            </View>
            {predictions.length === 0 && (
              <View style={styles.tableRowLast}><Text style={[styles.tableCell, { flex: 6.9 }]}>Nenhuma predição no período.</Text></View>
            )}
            {predictions.map((p, i) => (
              <View key={p.id} style={i === predictions.length - 1 ? styles.tableRowLast : styles.tableRow} wrap={false}>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{fmt(p.createdAt)}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{p.equipment.tag}</Text>
                <Text style={[styles.tableCell, { flex: 1.2 }]}>{(p.failureProbability * 100).toFixed(1)}%</Text>
                <View style={[styles.tableCell, { flex: 1.2 }]}>
                  <Badge label={RISK_LABEL[p.riskLevel] ?? p.riskLevel} color={riskColor(p.riskLevel)} />
                </View>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{p.modelVersion}</Text>
              </View>
            ))}
          </View>
        </View>
      </ReportPage>
    </Document>
  );
}
