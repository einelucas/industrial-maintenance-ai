import Link from "next/link";
import { notFound } from "next/navigation";
import { sensorDeviceService } from "@/features/sensor-devices/services/sensor-device.service";
import { revokeSensorDeviceAction } from "@/features/sensor-devices/actions/revoke-sensor-device.action";
import { ReprovisionSensorDeviceButton } from "@/features/sensor-devices/components/reprovision-sensor-device-button";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatDateTime } from "@/lib/utils/format";
import { setSensorDeviceMaintenanceAction } from "@/features/sensor-devices/actions/set-sensor-device-maintenance.action";

export default async function SensorDeviceDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePermission("device:view");
  const device = await sensorDeviceService.getOrThrow(params.id).catch(() => null);
  if (!device) notFound();

  const canManage = can(user.role, "device:manage");
  const isRevoked = device.status === "DISABLED";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Dispositivos", href: "/sensor-devices" },
              { label: device.serialNumber },
            ]}
          />
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{device.serialNumber}</h1>
            <Badge variant={isRevoked ? "high" : "neutral"}>{device.status}</Badge>
          </div>
        </div>
        {canManage && !isRevoked && (
          <div className="flex flex-wrap gap-2"><form action={setSensorDeviceMaintenanceAction}><input type="hidden" name="deviceId" value={device.id} /><input type="hidden" name="maintenance" value={device.status === "MAINTENANCE" ? "false" : "true"} /><Button type="submit" variant="outline">{device.status === "MAINTENANCE" ? "Sair da manutenção" : "Colocar em manutenção"}</Button></form><form action={revokeSensorDeviceAction}>
            <input type="hidden" name="deviceId" value={device.id} />
            <Button type="submit" variant="destructive">
              Revogar
            </Button>
          </form></div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Nome</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{device.name}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ponto termográfico</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link href={`/thermal-points/${device.thermalPoint.id}`} className="text-primary hover:underline">
              {device.thermalPoint.code}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fabricante / Modelo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {device.manufacturer ?? "—"} {device.model ? `/ ${device.model}` : ""}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Firmware</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{device.firmwareVersion ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Última comunicação</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{device.lastSeenAt ? formatDateTime(device.lastSeenAt) : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Provisionado em</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{formatDateTime(device.createdAt)}</CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Credencial</CardTitle></CardHeader><CardContent className="text-sm">Versão {device.credentialVersion} · Rotação: {formatDateTime(device.credentialRotatedAt)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Falhas de autenticação</CardTitle></CardHeader><CardContent className="text-sm">Consecutivas: {device.consecutiveAuthFailures} · Última: {formatDateTime(device.lastAuthFailureAt)}</CardContent></Card>
        {isRevoked && (
          <Card>
            <CardHeader>
              <CardTitle>Revogado em</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{device.disabledAt ? formatDateTime(device.disabledAt) : "—"}</CardContent>
          </Card>
        )}
      </div>

      {canManage && isRevoked && (
        <Card>
          <CardHeader>
            <CardTitle>Credencial revogada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              A credencial antiga foi invalidada e não pode mais ser usada. Para voltar a operar, gere uma credencial
              nova (nunca reaproveitamos o hash revogado).
            </p>
            <ReprovisionSensorDeviceButton deviceId={device.id} />
          </CardContent>
        </Card>
      )}

      <Card><CardHeader><CardTitle>Alertas técnicos de comunicação</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{!device.technicalAlerts.length && <p>Nenhum alerta técnico registrado.</p>}{device.technicalAlerts.map((alert) => <div key={alert.id} className="rounded-md border p-3"><p className="font-medium">{alert.type} · {alert.status}</p><p className="text-muted-foreground">Aberto: {formatDateTime(alert.openedAt)} · Última observação: {formatDateTime(alert.lastObservedAt)} · Resolvido: {formatDateTime(alert.resolvedAt)}</p></div>)}</CardContent></Card>
    </div>
  );
}
