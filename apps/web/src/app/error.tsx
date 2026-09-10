"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-md">
        <CardHeader className="items-center text-center">
          <AlertTriangle className="h-8 w-8 text-status-critical" />
          <CardTitle className="text-base text-foreground">
            Algo deu errado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {error.message || "Ocorreu um erro inesperado."}
          </p>
          <Button onClick={reset}>Tentar novamente</Button>
        </CardContent>
      </Card>
    </div>
  );
}
