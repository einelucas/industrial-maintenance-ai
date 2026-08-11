import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export function Header({ userName, userRole }: { userName: string; userRole: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div className="text-sm text-muted-foreground">Planejamento e Controle da Manutenção</div>
      <div className="flex items-center gap-4">
        <UserMenu userName={userName} userRole={userRole} />
        <ThemeToggle />
      </div>
    </header>
  );
}
