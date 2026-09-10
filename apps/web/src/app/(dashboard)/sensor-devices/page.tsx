import Link from "next/link";
import { Plus } from "lucide-react";
import type { DeviceStatus } from "@prisma/client";
import { sensorDeviceService } from "@/features/sensor-devices/services/sensor-device.service";
import { thermalPointService } from "@/features/thermal-points/services/thermal-point.service";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions/policies";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DEFAULT_PAGE_SIZE, parsePage, totalPages } from "@/lib/pagination";
import { formatDateTime } from "@/lib/utils/format";

const STATUS_OPTIONS: DeviceStatus[] = ["PROVISIONING", "ONLINE", "OFFLINE", "DEGRADED", "MAINTENANCE", "DISABLED"];
const STATUS_VARIANT: Record<DeviceStatus, "neutral" | "attention" | "high" | "muted"> = {
  PROVISIONING: "attention",
  ONLINE: "neutral",
  OFFLINE: "muted",
  DEGRADED: "attention",
  MAINTENANCE: "muted",
  DISABLED: "high",
};

type SearchParams = { thermalPointId?: string; status?: string; page?: string };

export default async function SensorDevicesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("device:view");
  const page = parsePage(searchParams.page);
  const points = await thermalPointService.listActive();

  const { items: devices, total } = await sensorDeviceService.listFiltered({
    thermalPointId: searchParams.thermalPointId || undefined,
    status: (searchParams.status as DeviceStatus) || undefined,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Dispositivos" }]} />
          <h1 className="text-xl font-semibold">Dispositivos</h1>
          <p className="text-sm text-muted-foreground">
            Dispositivos autenticados individualmente, com rotação, revogação e estado de comunicação auditável.
          </p>
        </div>
        {can(user.role, "device:manage") && (
          <Button asChild>
            <Link href="/sensor-devices/new">
              <Plus className="h-4 w-4" /> Provisionar dispositivo
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="thermalPointId">Ponto</Label>
              <Select id="thermalPointId" name="thermalPointId" defaultValue={searchParams.thermalPointId ?? ""} className="w-44">
                <option value="">Todos</option>
                {points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={searchParams.status ?? ""} className="w-40">
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/sensor-devices">Limpar</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número de série</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Ponto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Última comunicação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum dispositivo encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/sensor-devices/${device.id}`} className="text-primary hover:underline">
                      {device.serialNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{device.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{device.thermalPoint.code}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[device.status]}>{device.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {device.lastSeenAt ? formatDateTime(device.lastSeenAt) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages(total)} basePath="/sensor-devices" searchParams={searchParams} />
        </CardContent>
      </Card>
    </div>
  );
}
