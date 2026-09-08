import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { MobileNavigation, Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Suspense } from "react";
import { ThermalAiBanner } from "@/features/thermal-monitoring/components/thermal-status";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  PLANNER: "Planejador",
  TECHNICIAN: "Técnico",
  MANAGER: "Gestor",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar role={session.user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header userName={session.user.name} userRole={ROLE_LABEL[session.user.role] ?? session.user.role} />
        <MobileNavigation role={session.user.role} />
        <main className="min-w-0 flex-1 space-y-6 p-4 md:p-6">
          <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Verificando disponibilidade da IA térmica…</p>}><ThermalAiBanner /></Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
