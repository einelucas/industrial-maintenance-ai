import { notFound } from "next/navigation";
import { userService } from "@/features/users/services/user.service";
import { requirePermission } from "@/lib/auth/session";
import { UserForm } from "@/features/users/components/user-form";
import { ResetPasswordForm } from "@/features/users/components/reset-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  await requirePermission("user:manage");

  const user = await userService.getOrThrow(params.id).catch(() => null);
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Usuários", href: "/users" },
            { label: user.name },
          ]}
        />
        <h1 className="text-xl font-semibold">Editar usuário</h1>
      </div>
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <UserForm mode="edit" user={user} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm userId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
