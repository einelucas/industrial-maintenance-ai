import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

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
      <div className="flex flex-1 flex-col">
        <Header userName={session.user.name} userRole={ROLE_LABEL[session.user.role] ?? session.user.role} />
        <main className="flex-1 space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}
