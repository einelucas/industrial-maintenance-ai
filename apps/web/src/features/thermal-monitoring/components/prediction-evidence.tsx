import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThermalRiskBadge } from "./thermal-status";
import { numeric, type TraceablePrediction } from "@/features/thermal-monitoring/services/thermal-presentation";
import { formatDateTime } from "@/lib/utils/format";

export function PredictionEvidence({ prediction, title = "Evidência da IA" }: { prediction: TraceablePrediction; title?: string }) {
  const explanations = Array.isArray(prediction.explanations) ? prediction.explanations.filter((v): v is string => typeof v === "string") : [];
  return <Card id={`prediction-${prediction.id}`}>
    <CardHeader><CardTitle>{title}</CardTitle><div className="flex flex-wrap gap-2"><ThermalRiskBadge risk={prediction.riskLevel} />{prediction.thermalReading?.source === "SIMULATOR" && <Badge>Dados sintéticos</Badge>}{prediction.modelStage === "SYNTHETIC_EXPERIMENTAL" && <Badge>Modelo treinado com dados sintéticos</Badge>}</div></CardHeader>
    <CardContent className="space-y-4 text-sm">
      <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-muted-foreground">Modo de falha provável</dt><dd>{prediction.predictedFailureMode}</dd></div><div><dt className="text-muted-foreground">Confiança / confiança do modo de falha</dt><dd>{numeric(prediction.confidence == null ? null : prediction.confidence * 100, "%")} / {numeric(prediction.failureModeConfidence == null ? null : prediction.failureModeConfidence * 100, "%")}</dd></div><div><dt className="text-muted-foreground">Score de risco / do modelo</dt><dd>{numeric(prediction.riskScore)} / {numeric(prediction.modelScore)}</dd></div><div><dt className="text-muted-foreground">Tendência / persistência acima do limite</dt><dd>{numeric(prediction.trendCPerHour, " °C/h")} / {numeric(prediction.timeAboveLimitMin, " min")}</dd></div></dl>
      <div><h3 className="font-medium">Fatores determinantes</h3><ul className="mt-2 list-disc space-y-1 pl-5">{explanations.map((explanation, index) => <li key={index}>{explanation}</li>)}</ul></div>
      <p><strong>Ação sugerida pela IA:</strong> {prediction.recommendedAction ?? "Não informada pelo modelo."}</p>
      <dl className="space-y-1 break-words rounded-md bg-muted p-3 text-xs">
        <div><dt className="inline font-semibold">Prediction: </dt><dd className="inline">{prediction.id}</dd></div>
        <div><dt className="inline font-semibold">Leitura: </dt><dd className="inline">{prediction.thermalReadingId} · {formatDateTime(prediction.thermalReading?.measuredAt)}</dd></div>
        <div><dt className="inline font-semibold">Inferência: </dt><dd className="inline">{prediction.inferenceId} · {formatDateTime(prediction.createdAt)}</dd></div>
        <div><dt className="inline font-semibold">Requisição / features: </dt><dd className="inline">{prediction.inferenceRequestId} / {prediction.featureVersion}</dd></div>
        <div><dt className="inline font-semibold">Modelo: </dt><dd className="inline">{prediction.modelVersion} · {prediction.modelStage}</dd></div>
        <div><dt className="inline font-semibold">Checksum: </dt><dd className="inline break-all">{prediction.modelChecksum}</dd></div>
      </dl>
    </CardContent>
  </Card>;
}
