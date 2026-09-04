import Link from "next/link";
import {
  LayoutDashboard,
  Factory,
  ClipboardList,
  CalendarClock,
  Activity,
  AlertTriangle,
  FileBarChart,
  Wrench,
  Users,
  Settings,
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
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/equipments", label: "Equipamentos", icon: Factory },
  { href: "/work-orders", label: "Ordens de Serviço", icon: ClipboardList },
  { href: "/maintenance-plans", label: "Planos Preventivos", icon: Wrench },
  { href: "/predictive-maintenance", label: "Manutenção Preditiva", icon: Activity },
  { href: "/alerts", label: "Alertas", icon: AlertTriangle },
  { href: "/schedule", label: "Cronograma", icon: CalendarClock },
  { href: "/reports", label: "Relatórios", icon: FileBarChart },
  // Domínio termográfico (GPMS 2026 / Etapa 3) — cadastro estrutural, sem
  // dashboard analítico (isso é Etapa 6).
  { href: "/electrical-panels", label: "Painéis Elétricos", icon: PanelsTopLeft, permission: "panel:view" },
  { href: "/monitored-components", label: "Componentes Monitorados", icon: Cpu, permission: "panel:view" },
  { href: "/thermal-points", label: "Pontos Termográficos", icon: Thermometer, permission: "thermal-point:view" },
  { href: "/thermal-readings", label: "Leituras Termográficas", icon: Gauge, permission: "thermal-reading:view" },
  { href: "/sensor-devices", label: "Dispositivos", icon: Radio, permission: "device:view" },
  { href: "/users", label: "Usuários", icon: Users, permission: "user:manage" },
  { href: "/settings", label: "Configurações", icon: Settings, permission: "settings:manage" },
  { href: "/settings/thermal", label: "Config. Térmica", icon: SlidersHorizontal, permission: "thermal-settings:manage" },
];

export function Sidebar({ role }: { role: UserRole }) {
  const items = NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
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
