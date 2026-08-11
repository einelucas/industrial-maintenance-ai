"use client";

import { useFormState } from "react-dom";
import { createUserAction } from "@/features/users/actions/create-user.action";
import { updateUserAction, type UserFormState } from "@/features/users/actions/update-user.action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";

const initialState: UserFormState = {};

type SafeUser = { id: string; name: string; email: string; role: "ADMIN" | "PLANNER" | "TECHNICIAN" | "MANAGER" };

type UserFormProps =
  | { mode?: "create"; user?: undefined }
  | { mode: "edit"; user: SafeUser };

export function UserForm(props: UserFormProps) {
  const mode = props.mode ?? "create";
  const action = props.mode === "edit" ? updateUserAction.bind(null, props.user.id) : createUserAction;
  const user = props.mode === "edit" ? props.user : undefined;
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" required defaultValue={user?.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail *</Label>
        <Input id="email" name="email" type="email" required defaultValue={user?.email} />
      </div>
      {mode === "create" && (
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha *</Label>
          <Input id="password" name="password" type="password" required minLength={8} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="role">Perfil *</Label>
        <Select id="role" name="role" required defaultValue={user?.role ?? "TECHNICIAN"}>
          <option value="ADMIN">Administrador</option>
          <option value="PLANNER">Planejador</option>
          <option value="TECHNICIAN">Técnico</option>
          <option value="MANAGER">Gestor</option>
        </Select>
      </div>

      {state.error && <p className="text-sm text-status-critical sm:col-span-2">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-status-neutral sm:col-span-2">
          {mode === "edit" ? "Usuário atualizado com sucesso." : "Usuário criado com sucesso."}
        </p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton pendingText="Salvando...">{mode === "edit" ? "Salvar alterações" : "Criar usuário"}</SubmitButton>
      </div>
    </form>
  );
}
