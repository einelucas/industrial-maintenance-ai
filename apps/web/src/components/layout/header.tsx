import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export function Header({ userName, userRole }: { userName: string; userRole: string }) {
  return (
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2 md:px-6">
      <div className="text-sm text-muted-foreground">Manutenção térmica</div>
      <div className="flex min-w-0 items-center gap-4">
        <UserMenu userName={userName} userRole={userRole} />
        <ThemeToggle />
      </div>
    </header>
  );
}
