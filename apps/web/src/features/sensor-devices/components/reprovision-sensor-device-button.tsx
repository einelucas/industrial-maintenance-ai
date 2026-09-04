"use client";

import { useFormState } from "react-dom";
import { reprovisionSensorDeviceAction } from "@/features/sensor-devices/actions/reprovision-sensor-device.action";
import type { ProvisionSensorDeviceState } from "@/features/sensor-devices/actions/provision-sensor-device.action";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: ProvisionSensorDeviceState = {};

export function ReprovisionSensorDeviceButton({ deviceId }: { deviceId: string }) {
  const action = reprovisionSensorDeviceAction.bind(null, deviceId);
  const [state, formAction] = useFormState(action, initialState);

  if (state.apiKey) {
    return (
      <div className="rounded-md border border-status-attention/40 bg-status-attention/10 p-4 text-sm">
        <p className="font-semibold text-status-attention">
          Nova chave gerada para {state.serialNumber}. Copie agora — ela não será exibida novamente.
        </p>
        <code className="mt-2 block break-all rounded bg-card p-3 font-mono text-xs">{state.apiKey}</code>
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state.error && <p className="mb-2 text-sm text-status-critical">{state.error}</p>}
      <SubmitButton pendingText="Gerando...">Gerar nova credencial</SubmitButton>
    </form>
  );
}
