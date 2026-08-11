import bcrypt from "bcryptjs";
import { userRepository, type UserFilters } from "@/features/users/repositories/user.repository";
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/features/users/schemas/user.schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

export const userService = {
  list: () => userRepository.findAll(),

  listFiltered: (filters: UserFilters) => userRepository.findFiltered(filters),

  async getOrThrow(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError("Usuário", id);
    return user;
  },

  async create(input: unknown) {
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados do usuário inválidos.", parsed.error.flatten().fieldErrors);
    }

    const existing = await userRepository.findByEmail(parsed.data.email);
    if (existing) {
      throw new ConflictError(`Já existe um usuário com o e-mail "${parsed.data.email}".`);
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    return userRepository.create({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    });
  },

  async update(id: string, input: unknown) {
    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados do usuário inválidos.", parsed.error.flatten().fieldErrors);
    }

    await this.getOrThrow(id);

    const existing = await userRepository.findByEmail(parsed.data.email);
    if (existing && existing.id !== id) {
      throw new ConflictError(`Já existe um usuário com o e-mail "${parsed.data.email}".`);
    }

    return userRepository.update(id, parsed.data);
  },

  async setActive(id: string, active: boolean, actingUserId: string) {
    if (id === actingUserId && !active) {
      throw new ForbiddenError("Você não pode desativar a própria conta.");
    }
    await this.getOrThrow(id);
    return userRepository.setActive(id, active);
  },

  /** Admin redefine a senha de outro usuário — não exige a senha atual. */
  async resetPassword(id: string, input: unknown) {
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Senha inválida.", parsed.error.flatten().fieldErrors);
    }
    await this.getOrThrow(id);
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    return userRepository.updatePasswordHash(id, passwordHash);
  },

  /** Usuário troca a própria senha — exige a senha atual correta. */
  async changeOwnPassword(id: string, input: unknown) {
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados inválidos.", parsed.error.flatten().fieldErrors);
    }
    const { currentPassword, newPassword, confirmPassword } = parsed.data;

    if (newPassword !== confirmPassword) {
      throw new ValidationError("A nova senha e a confirmação não coincidem.");
    }

    const user = await userRepository.findByIdWithPasswordHash(id);
    if (!user) throw new NotFoundError("Usuário", id);

    const currentIsValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentIsValid) {
      throw new ValidationError("Senha atual incorreta.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    return userRepository.updatePasswordHash(id, passwordHash);
  },
};
