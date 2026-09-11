import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Bloco compartilhado por app/error.tsx e app/(dashboard)/error.tsx (antes
// quase duplicados). Mantém role="alert" para leitores de tela anunciarem a
// falha sem depender de cor.
export function ErrorState({
  error,
  reset,
  homeHref,
  homeLabel = "Voltar ao início",
  fullScreen = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
  fullScreen?: boolean;
}) {
  return (
    <div
      role="alert"
      className={fullScreen ? "flex min-h-screen items-center justify-center bg-background p-6" : "flex min-h-[60vh] items-center justify-center"}
    >
      <Card className="max-w-md">
        <CardHeader className="items-center text-center">
          <AlertTriangle className="h-8 w-8 text-status-critical" aria-hidden="true" />
          <CardTitle className="text-base text-foreground">Algo deu errado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {error.message || "Ocorreu um erro inesperado ao carregar esta página."}
          </p>
          <div className="flex justify-center gap-2">
            {homeHref && (
              <Button variant="outline" asChild>
                <Link href={homeHref}>{homeLabel}</Link>
              </Button>
            )}
            <Button onClick={reset}>Tentar novamente</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
