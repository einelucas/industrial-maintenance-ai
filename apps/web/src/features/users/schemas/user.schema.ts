import { z } from "zod";

const ROLE = z.enum(["ADMIN", "PLANNER", "TECHNICIAN", "MANAGER"]);

export const createUserSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
  role: ROLE,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório."),
  email: z.string().email("E-mail inválido."),
  role: ROLE,
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Admin redefinindo a senha de outro usuário — não exige a senha atual.
export const resetPasswordSchema = z.object({
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Usuário trocando a própria senha — exige a senha atual. A checagem de
// "nova senha === confirmação" fica no service (não em .refine()): um
// .refine() sem `path` cai em `formErrors`, e a UI deste projeto só exibe a
// mensagem genérica de ValidationError.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z.string().min(8, "A nova senha deve ter ao menos 8 caracteres."),
  confirmPassword: z.string().min(1, "Confirme a nova senha."),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
