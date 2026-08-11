"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md">
        <CardHeader className="items-center text-center">
          <AlertTriangle className="h-8 w-8 text-status-critical" />
          <CardTitle className="text-base text-foreground">Algo deu errado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {error.message || "Ocorreu um erro inesperado ao carregar esta página."}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard">Voltar ao Dashboard</Link>
            </Button>
            <Button onClick={reset}>Tentar novamente</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
