"use client";

import { useFormState } from "react-dom";
import type { ThermalPoint } from "@prisma/client";
import {
  provisionSensorDeviceAction,
  type ProvisionSensorDeviceState,
} from "@/features/sensor-devices/actions/provision-sensor-device.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: ProvisionSensorDeviceState = {};

export function ProvisionSensorDeviceForm({ points, defaultThermalPointId }: { points: ThermalPoint[]; defaultThermalPointId?: string }) {
  const [state, formAction] = useFormState(provisionSensorDeviceAction, initialState);

  if (state.apiKey) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-status-attention/40 bg-status-attention/10 p-4 text-sm">
          <p className="font-semibold text-status-attention">
            Dispositivo {state.serialNumber} provisionado. Copie a chave agora — ela não será exibida novamente.
          </p>
          <code className="mt-2 block break-all rounded bg-card p-3 font-mono text-xs">{state.apiKey}</code>
        </div>
        <a href="/sensor-devices" className="text-sm text-primary hover:underline">
          Voltar para a lista de dispositivos
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="serialNumber">Número de série *</Label>
        <Input id="serialNumber" name="serialNumber" required placeholder="ESP32-001" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" required placeholder="Sensor pontual — TP-056" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="thermalPointId">Ponto termográfico *</Label>
        <Select id="thermalPointId" name="thermalPointId" required defaultValue={defaultThermalPointId ?? ""}>
          <option value="" disabled>
            Selecione...
          </option>
          {points.map((point) => (
            <option key={point.id} value={point.id}>
              {point.code} — {point.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="manufacturer">Fabricante</Label>
        <Input id="manufacturer" name="manufacturer" placeholder="Schneider Electric" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="model">Modelo</Label>
        <Input id="model" name="model" placeholder="PowerLogic Thermal Tag SPTH150S" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="firmwareVersion">Versão do firmware</Label>
        <Input id="firmwareVersion" name="firmwareVersion" placeholder="Confirmar no dispositivo instalado" />
      </div>

      <p className="text-xs text-muted-foreground sm:col-span-2">
        Registre a referência comercial exatamente como aparece na etiqueta ou ficha técnica. Não invente número de
        série nem versão de firmware: quando o dado não estiver disponível, indique que depende de confirmação em
        campo.
      </p>

      {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Provisionando...">Provisionar dispositivo</SubmitButton>
      </div>
    </form>
  );
}
