import Link from "next/link";
import { Plus } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { userService } from "@/features/users/services/user.service";
import { toggleActiveUserAction } from "@/features/users/actions/toggle-active-user.action";
import { requirePermission } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DEFAULT_PAGE_SIZE, parsePage, totalPages } from "@/lib/pagination";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  PLANNER: "Planejador",
  TECHNICIAN: "Técnico",
  MANAGER: "Gestor",
};

const ROLE_OPTIONS: UserRole[] = ["ADMIN", "PLANNER", "TECHNICIAN", "MANAGER"];

type SearchParams = { search?: string; role?: string; active?: string; page?: string };

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("user:manage");
  const page = parsePage(searchParams.page);

  const { items: users, total } = await userService.listFiltered({
    search: searchParams.search || undefined,
    role: (searchParams.role as UserRole) || undefined,
    active: searchParams.active === "true" ? true : searchParams.active === "false" ? false : undefined,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Usuários" }]} />
          <h1 className="text-xl font-semibold">Usuários</h1>
        </div>
        <Button asChild>
          <Link href="/users/new">
            <Plus className="h-4 w-4" /> Novo usuário
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="search">Buscar</Label>
              <Input id="search" name="search" placeholder="Nome ou e-mail..." defaultValue={searchParams.search ?? ""} className="w-56" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role">Perfil</Label>
              <Select id="role" name="role" defaultValue={searchParams.role ?? ""} className="w-44">
                <option value="">Todos</option>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="active">Status</Label>
              <Select id="active" name="active" defaultValue={searchParams.active ?? ""} className="w-36">
                <option value="">Todos</option>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/users">Limpar</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                <TableHead className="hidden sm:table-cell">Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum usuário encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link href={`/users/${user.id}`} className="text-primary hover:underline">
                      {user.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{user.email}</TableCell>
                  <TableCell className="hidden sm:table-cell">{ROLE_LABEL[user.role] ?? user.role}</TableCell>
                  <TableCell>
                    <Badge variant={user.active ? "neutral" : "muted"}>{user.active ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell>
                    <form action={toggleActiveUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="nextActive" value={(!user.active).toString()} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={user.id === actor.id && user.active}
                      >
                        {user.active ? "Desativar" : "Ativar"}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages(total)} basePath="/users" searchParams={searchParams} />
        </CardContent>
      </Card>
    </div>
  );
}
