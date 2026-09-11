"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  Cpu,
  Crosshair,
  Factory,
  FileText,
  Gauge,
  PanelsTopLeft,
  Radio,
  SlidersHorizontal,
  Thermometer,
  Users,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { can, type Permission } from "@/lib/permissions/policies";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof Thermometer;
  permission?: Permission;
};

const NAVIGATION_SECTIONS: { label: string; items: NavigationItem[] }[] = [
  {
    label: "Fluxo preditivo",
    items: [
      { href: "/thermal-monitoring", label: "Monitoramento", icon: Thermometer, permission: "thermal-point:view" },
      { href: "/thermal-incidents", label: "Incidentes térmicos", icon: AlertTriangle, permission: "incident:view" },
      { href: "/work-orders", label: "Ordens de Serviço", icon: ClipboardList, permission: "workorder:view" },
      { href: "/schedule", label: "Cronograma", icon: CalendarClock, permission: "workorder:view" },
    ],
  },
  {
    label: "Infraestrutura monitorada",
    items: [
      { href: "/equipments", label: "Equipamentos", icon: Factory },
      { href: "/electrical-panels", label: "Painéis elétricos", icon: PanelsTopLeft, permission: "panel:view" },
      { href: "/monitored-components", label: "Componentes", icon: Cpu, permission: "panel:view" },
      { href: "/thermal-points", label: "Pontos termográficos", icon: Crosshair, permission: "thermal-point:view" },
      { href: "/sensor-devices", label: "Dispositivos IoT", icon: Radio, permission: "device:view" },
    ],
  },
  {
    label: "Evidências",
    items: [
      { href: "/thermal-readings", label: "Leituras térmicas", icon: Gauge, permission: "thermal-reading:view" },
      { href: "/reports", label: "Relatórios", icon: FileText, permission: "report:view" },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/users", label: "Usuários", icon: Users, permission: "user:manage" },
      { href: "/settings/thermal-risk", label: "Configuração térmica", icon: SlidersHorizontal, permission: "thermal-settings:manage" },
    ],
  },
];

function availableSections(role: UserRole) {
  return NAVIGATION_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || can(role, item.permission)),
  })).filter((section) => section.items.length > 0);
}
function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({ item, pathname, mobile = false }: { item: NavigationItem; pathname: string; mobile?: boolean }) {
  const active = isCurrentPath(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        mobile ? "px-3 py-3" : "px-3 py-2",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-foreground/75 hover:bg-muted hover:text-foreground"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const sections = availableSections(role);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col" aria-label="Navegação principal">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-[0.65rem] font-bold">
          GPMS
        </div>
        <div className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">Manutenção Preditiva</span>
          <span className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">Termografia e IA</span>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section.label} className="space-y-1">
            <p className="px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
            {section.items.map((item) => (
              <NavigationLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function MobileNavigation({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const sections = availableSections(role);
  const activeItem = sections.flatMap((section) => section.items).find((item) => isCurrentPath(pathname, item.href));

  return (
    <details className="border-b bg-card px-4 py-3 md:hidden">
      <summary className="cursor-pointer text-sm font-medium">
        Menu · {activeItem?.label ?? "GPMS 2026"}
      </summary>
      <nav aria-label="Navegação mobile" className="space-y-4 pt-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-1 px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {section.items.map((item) => (
                <NavigationLink key={item.href} item={item} pathname={pathname} mobile />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </details>
  );
}
