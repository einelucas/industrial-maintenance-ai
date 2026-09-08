"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { submitHumanReviewAction } from "@/features/thermal-incidents/actions/submit-human-review.action";
import { createPredictiveWorkOrderFromIncidentAction } from "@/features/thermal-incidents/actions/create-predictive-work-order-from-incident.action";
import { REVIEW_LABELS } from "@/features/thermal-incidents/services/incident-presentation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ReviewButtons() {
  const { pending } = useFormStatus();
  return <div className="flex flex-wrap gap-2">{Object.entries(REVIEW_LABELS).map(([decision, label]) => <Button key={decision} type="submit" name="decision" value={decision} disabled={pending} variant={decision === "CONFIRMED" ? "default" : "outline"}>{pending ? "Registrando…" : label}</Button>)}</div>;
}

function CreateOrderButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Criando OS…" : "Autorizar e criar OS preditiva"}</Button>;
}

export function HumanReviewForm({ incidentId, predictionId, blockedReason }: { incidentId: string; predictionId: string; blockedReason: string | null }) {
  const [state, action] = useFormState(submitHumanReviewAction, {});
  return <form action={action} className="space-y-3">
    <input type="hidden" name="thermalIncidentId" value={incidentId} />
    <input type="hidden" name="expectedPredictionId" value={predictionId} />
    <p className="break-all text-xs text-muted-foreground">Revisando a Prediction {predictionId}. O registro identifica o profissional e preserva a evidência original.</p>
    <fieldset disabled={!!blockedReason} className="space-y-3"><Label htmlFor="justification">Justificativa da decisão</Label><textarea id="justification" name="justification" maxLength={2000} rows={4} aria-describedby="justification-help" className="w-full rounded-md border border-input bg-background p-3 text-sm" />
      <p id="justification-help" className="text-xs text-muted-foreground">Obrigatória para rejeitar, declarar inconclusivo ou solicitar nova leitura; até 2.000 caracteres.</p><ReviewButtons /></fieldset>
    {blockedReason && <p className="text-sm text-muted-foreground">{blockedReason}</p>}
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state.success && <p role="status" className="text-sm">Revisão registrada no histórico.</p>}
  </form>;
}

export function PredictiveWorkOrderForm({ incidentId, blockedReason }: { incidentId: string; blockedReason: string | null }) {
  const [state, action] = useFormState(createPredictiveWorkOrderFromIncidentAction, {});
  return <form action={action} className="space-y-3"><input type="hidden" name="thermalIncidentId" value={incidentId} />
    <fieldset disabled={!!blockedReason || !!state.success} className="space-y-3"><Label htmlFor="order-title">Título da OS (opcional)</Label><Input id="order-title" name="title" maxLength={200} placeholder="Usar título do incidente" /><Label htmlFor="order-notes">Observações para a manutenção</Label><textarea id="order-notes" name="notes" rows={3} maxLength={2000} className="w-full rounded-md border border-input bg-background p-3 text-sm" /><CreateOrderButton /></fieldset>
    {blockedReason && <p className="text-sm text-muted-foreground">{blockedReason}</p>}{state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state.success && state.workOrderId && <p role="status">OS criada. <Link className="text-primary underline" href={`/work-orders/${state.workOrderId}`}>Abrir ordem de serviço</Link></p>}
  </form>;
}
