import { prisma } from "@/lib/db/client";
import type { Prisma, UserRole } from "@prisma/client";

// Nunca expor passwordHash fora deste repositório.
const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export interface UserFilters {
  search?: string;
  role?: UserRole;
  active?: boolean;
  skip?: number;
  take?: number;
}

export const userRepository = {
  findAll: () => prisma.user.findMany({ select: SAFE_SELECT, orderBy: { name: "asc" } }),

  // Busca (nome ou e-mail) + filtro de perfil/status + paginação — usado por /users.
  async findFiltered(filters: UserFilters) {
    const where: Prisma.UserWhereInput = {};
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.role) where.role = filters.role;
    if (filters.active !== undefined) where.active = filters.active;

    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, select: SAFE_SELECT, orderBy: { name: "asc" }, skip: filters.skip, take: filters.take }),
      prisma.user.count({ where }),
    ]);

    return { items, total };
  },

  findById: (id: string) => prisma.user.findUnique({ where: { id }, select: SAFE_SELECT }),

  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),

  // Inclui passwordHash de propósito — só para o service comparar a senha
  // atual antes de trocar (changeOwnPassword). Nunca devolver isso pra fora
  // da camada de service.
  findByIdWithPasswordHash: (id: string) => prisma.user.findUnique({ where: { id } }),

  updatePasswordHash: (id: string, passwordHash: string) =>
    prisma.user.update({ where: { id }, data: { passwordHash }, select: SAFE_SELECT }),

  create: (data: { name: string; email: string; passwordHash: string; role: Prisma.UserCreateInput["role"] }) =>
    prisma.user.create({ data, select: SAFE_SELECT }),

  update: (id: string, data: { name: string; email: string; role: Prisma.UserUpdateInput["role"] }) =>
    prisma.user.update({ where: { id }, data, select: SAFE_SELECT }),

  setActive: (id: string, active: boolean) =>
    prisma.user.update({ where: { id }, data: { active }, select: SAFE_SELECT }),
};
