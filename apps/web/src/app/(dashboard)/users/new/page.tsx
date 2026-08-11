import { requirePermission } from "@/lib/auth/session";
import { UserForm } from "@/features/users/components/user-form";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default async function NewUserPage() {
  await requirePermission("user:manage");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Usuários", href: "/users" },
            { label: "Novo" },
          ]}
        />
        <h1 className="text-xl font-semibold">Novo usuário</h1>
      </div>
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <UserForm />
        </CardContent>
      </Card>
    </div>
  );
}
