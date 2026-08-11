import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDate(date: Date | string | null | undefined, pattern = "dd/MM/yyyy"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, pattern, { locale: ptBR });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, "dd/MM/yyyy HH:mm");
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
