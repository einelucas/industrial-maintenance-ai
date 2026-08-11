"use client";

import { useFormState } from "react-dom";
import { signInAction, type SignInState } from "@/features/auth/actions/sign-in.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: SignInState = {};

export function LoginForm() {
  const [state, formAction] = useFormState(signInAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state.error && <p className="text-sm text-status-critical">{state.error}</p>}
      <SubmitButton className="w-full" pendingText="Entrando...">
        Entrar
      </SubmitButton>
    </form>
  );
}
