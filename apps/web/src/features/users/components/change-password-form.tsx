"use client";

import { useFormState } from "react-dom";
import { changeOwnPasswordAction, type ChangePasswordFormState } from "@/features/users/actions/change-own-password.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: ChangePasswordFormState = {};

export function ChangePasswordForm() {
  const [state, formAction] = useFormState(changeOwnPasswordAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="currentPassword">Senha atual *</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Nova senha *</Label>
        <Input id="newPassword" name="newPassword" type="password" required minLength={8} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar nova senha *</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}
      {state.success && <p className="text-sm text-status-neutral sm:col-span-2">Senha alterada com sucesso.</p>}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Salvando...">Alterar senha</SubmitButton>
      </div>
    </form>
  );
}
