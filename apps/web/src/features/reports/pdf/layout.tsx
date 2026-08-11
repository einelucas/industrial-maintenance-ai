import { Text, View, StyleSheet, Page, Font } from "@react-pdf/renderer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { COLORS } from "@/features/reports/pdf/theme";

// Desliga a hifenização automática (quebra estranha em PT-BR sem dicionário
// próprio configurado).
Font.registerHyphenationCallback((word) => [word]);

export const styles = StyleSheet.create({
  page: {
    paddingTop: 90,
    paddingBottom: 50,
    paddingHorizontal: 32,
    fontSize: 9,
    color: COLORS.foreground,
    fontFamily: "Helvetica",
  },
  header: {
    position: "absolute",
    top: 24,
    left: 32,
    right: 32,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 8,
  },
  brand: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.primary,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 10,
  },
  reportSubtitle: {
    fontSize: 9,
    color: COLORS.muted,
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.muted,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    color: COLORS.primary,
  },
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowLast: {
    flexDirection: "row",
  },
  tableHeaderCell: {
    padding: 5,
    fontSize: 8,
    fontWeight: 700,
    backgroundColor: COLORS.background,
    color: COLORS.muted,
  },
  tableCell: {
    padding: 5,
    fontSize: 8,
  },
  kvRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  kvLabel: {
    width: 130,
    color: COLORS.muted,
  },
  kvValue: {
    flex: 1,
  },
  badge: {
    fontSize: 7.5,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 3,
    color: "#ffffff",
    alignSelf: "flex-start",
  },
});

export function ReportHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerRow}>
        <Text style={styles.brand}>PCM — Industrial AI</Text>
        <Text>{format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</Text>
      </View>
      <Text style={styles.reportTitle}>{title}</Text>
      {subtitle && <Text style={styles.reportSubtitle}>{subtitle}</Text>}
    </View>
  );
}

export function ReportFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>Gerado automaticamente pelo sistema PCM — Industrial AI</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

export function ReportPage({ children }: { children: React.ReactNode }) {
  return (
    <Page size="A4" style={styles.page}>
      {children}
      <ReportFooter />
    </Page>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <Text style={[styles.badge, { backgroundColor: color }]}>{label}</Text>
  );
}
