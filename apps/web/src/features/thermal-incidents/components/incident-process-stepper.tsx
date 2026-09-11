import { CheckCircle2, Circle, Clock, Lock, MinusCircle } from "lucide-react";

export type StepStatus = "completed" | "current" | "pending" | "blocked" | "unavailable";

export interface ProcessStep {
  key: string;
  label: string;
  status: StepStatus;
  note?: string;
}

const STATUS_META: Record<StepStatus, { icon: typeof CheckCircle2; label: string; tone: string }> = {
  completed: { icon: CheckCircle2, label: "Concluída", tone: "text-status-neutral" },
  current: { icon: Clock, label: "Atual", tone: "text-status-attention" },
  pending: { icon: Circle, label: "Pendente", tone: "text-muted-foreground" },
  blocked: { icon: Lock, label: "Bloqueada", tone: "text-status-critical" },
  unavailable: { icon: MinusCircle, label: "Indisponível", tone: "text-muted-foreground" },
};

// Resumo visual das etapas do fluxo preditivo (inspeção → leitura →
// inferência → incidente → revisão humana → OS → pós-ação). A IA nunca
// aparece como etapa final — "Revisão humana" e as etapas seguintes sempre
// vêm depois de "Inferência da IA". Não substitui a linha do tempo
// auditável cronológica abaixo, que continua registrando os eventos reais.
export function IncidentProcessStepper({ steps }: { steps: ProcessStep[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7" aria-label="Etapas do processo preditivo">
      {steps.map((step, index) => {
        const meta = STATUS_META[step.status];
        return (
          <li key={step.key} className="flex items-start gap-2 rounded-md border bg-card p-2.5 text-xs">
            <meta.icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.tone}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">{index + 1}. {step.label}</p>
              <p className={meta.tone}>{meta.label}</p>
              {step.note && <p className="mt-0.5 text-muted-foreground">{step.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
