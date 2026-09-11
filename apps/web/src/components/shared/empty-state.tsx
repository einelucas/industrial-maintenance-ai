import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Estado vazio padrão do app: sempre texto + ícone (nunca só cor), com
// espaço opcional para explicar o que aconteceu e o que o usuário pode
// fazer a seguir (ex.: link para outra tela).
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
