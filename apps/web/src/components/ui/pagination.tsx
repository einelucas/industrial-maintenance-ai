import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function buildHref(basePath: string, searchParams: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// Server Component puro — sem client-side state, navega via <Link> nativo
// preservando os demais filtros já aplicados na URL.
export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const navClass = cn(buttonVariants({ variant: "outline", size: "sm" }));
  const disabledClass = cn(navClass, "pointer-events-none opacity-50");

  return (
    <div className="flex items-center justify-between border-t border-border px-3 py-3">
      <p className="text-xs text-muted-foreground">
        Página {page} de {totalPages}
      </p>
      <div className="flex gap-2">
        {page <= 1 ? (
          <span className={disabledClass}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </span>
        ) : (
          <Link href={buildHref(basePath, searchParams, page - 1)} className={navClass}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Link>
        )}
        {page >= totalPages ? (
          <span className={disabledClass}>
            Próxima <ChevronRight className="h-4 w-4" />
          </span>
        ) : (
          <Link href={buildHref(basePath, searchParams, page + 1)} className={navClass}>
            Próxima <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
