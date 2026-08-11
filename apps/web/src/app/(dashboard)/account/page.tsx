import { requireUser } from "@/lib/auth/session";
import { userService } from "@/features/users/services/user.service";
import { ChangePasswordForm } from "@/features/users/components/change-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  PLANNER: "Planejador",
  TECHNICIAN: "Técnico",
  MANAGER: "Gestor",
};

export default async function AccountPage() {
  const sessionUser = await requireUser();
  const user = await userService.getOrThrow(sessionUser.id);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Minha conta" }]} />
        <h1 className="text-xl font-semibold">Minha conta</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Nome</p>
            <p>{user.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">E-mail</p>
            <p>{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Perfil</p>
            <p>{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
