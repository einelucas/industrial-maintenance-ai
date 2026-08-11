"use client";

import { useFormState } from "react-dom";
import { resetUserPasswordAction, type ResetPasswordFormState } from "@/features/users/actions/reset-user-password.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: ResetPasswordFormState = {};

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, formAction] = useFormState(resetUserPasswordAction.bind(null, userId), initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="password">Nova senha *</Label>
        <Input id="password" name="password" type="password" required minLength={8} className="w-56" />
      </div>
      <SubmitButton variant="outline" pendingText="Redefinindo...">Redefinir senha</SubmitButton>
      {state.error && <p className="w-full text-sm text-status-critical">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-status-neutral">Senha redefinida com sucesso.</p>}
    </form>
  );
}
