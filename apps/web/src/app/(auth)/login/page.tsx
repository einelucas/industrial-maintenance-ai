import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            PCM
          </div>
          <h1 className="text-lg font-semibold">Industrial Maintenance Intelligence</h1>
          <p className="text-sm text-muted-foreground">Entre com suas credenciais para continuar.</p>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-muted-foreground">
          Usuário de demonstração: admin@pcm.local / admin123
        </p>
      </div>
    </div>
  );
}
