import Link from "next/link";
import {
  LayoutDashboard,
  Factory,
  ClipboardList,
  CalendarClock,
  AlertTriangle,
  Users,
  PanelsTopLeft,
  Cpu,
  Thermometer,
  Radio,
  SlidersHorizontal,
  Gauge,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { can, type Permission } from "@/lib/permissions/policies";

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; permission?: Permission }[] = [
  { href: "/thermal-monitoring", label: "Monitoramento térmico", icon: Thermometer, permission: "thermal-point:view" },
  { href: "/thermal-incidents", label: "Incidentes térmicos", icon: AlertTriangle, permission: "incident:view" },
  { href: "/equipments", label: "Equipamentos", icon: Factory },
  { href: "/work-orders", label: "Ordens de Serviço", icon: ClipboardList },
  { href: "/schedule", label: "Cronograma", icon: CalendarClock },
  { href: "/electrical-panels", label: "Painéis Elétricos", icon: PanelsTopLeft, permission: "panel:view" },
  { href: "/monitored-components", label: "Componentes Monitorados", icon: Cpu, permission: "panel:view" },
  { href: "/thermal-points", label: "Pontos Termográficos", icon: Thermometer, permission: "thermal-point:view" },
  { href: "/thermal-readings", label: "Leituras Termográficas", icon: Gauge, permission: "thermal-reading:view" },
  { href: "/sensor-devices", label: "Dispositivos", icon: Radio, permission: "device:view" },
  { href: "/users", label: "Usuários", icon: Users, permission: "user:manage" },
  { href: "/settings/thermal-risk", label: "Config. Térmica", icon: SlidersHorizontal, permission: "thermal-settings:manage" },
];

export function Sidebar({ role }: { role: UserRole }) {
  const items = NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col" aria-label="Navegação principal">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
          PCM
        </div>
        <span className="text-sm font-semibold">Industrial AI</span>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function MobileNavigation({ role }: { role: UserRole }) {
  const items = NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));
  return <details className="border-b bg-card px-4 py-3 md:hidden"><summary className="cursor-pointer text-sm font-medium">Menu de navegação</summary>
    <nav aria-label="Navegação mobile" className="grid grid-cols-1 gap-1 pt-3 sm:grid-cols-2">{items.map((item) => <Link key={item.href} href={item.href} className="rounded-md px-3 py-3 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">{item.label}</Link>)}</nav>
  </details>;
}
