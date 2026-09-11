import { Tag, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { COMPANY_PRIORITY_LABELS } from "@/features/thermal-priority/constants";
import type { CompanyThermalPriority } from "@prisma/client";

// Prioridade empresarial (P5–P100) é uma dimensão separada do risco atual
// da IA — por isso nunca usa as variantes neutral/attention/high/critical
// (que no resto do app já significam risco). P30/P50/P100 seguem
// explicitamente identificados como "definição empresarial pendente"
// (texto já embutido em COMPANY_PRIORITY_LABELS), nunca com um significado
// inventado.
const PENDING_DEFINITION: CompanyThermalPriority[] = ["P30", "P50", "P100"];

export function CompanyPriorityBadge({ priority, prefix }: { priority: CompanyThermalPriority; prefix?: string }) {
  const pending = PENDING_DEFINITION.includes(priority);
  const Icon = pending ? HelpCircle : Tag;
  return (
    <Badge variant="muted" className="gap-1">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {prefix ? `${prefix}: ` : ""}
      {COMPANY_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
