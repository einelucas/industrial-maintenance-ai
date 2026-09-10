import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/client", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

import { requirePermission, requireUser } from "./session";

describe("requireUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna os dados atuais do usuário ativo no banco", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: "session-user", name: "Nome antigo", email: "old@example.com", role: "TECHNICIAN" },
    });
    mocks.findUnique.mockResolvedValue({
      id: "session-user",
      name: "Nome atual",
      email: "current@example.com",
      role: "ADMIN",
      active: true,
    });

    await expect(requireUser()).resolves.toEqual({
      id: "session-user",
      name: "Nome atual",
      email: "current@example.com",
      role: "ADMIN",
      active: true,
    });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "session-user" },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  });

  it("rejeita um JWT cujo usuário não existe mais", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "stale-user", role: "ADMIN" } });
    mocks.findUnique.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow("Sua sessão não é mais válida");
  });

  it("rejeita um usuário desativado", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "inactive-user", role: "ADMIN" } });
    mocks.findUnique.mockResolvedValue({
      id: "inactive-user",
      name: "Inativo",
      email: "inactive@example.com",
      role: "ADMIN",
      active: false,
    });

    await expect(requireUser()).rejects.toThrow("Sua sessão não é mais válida");
  });

  it("avalia a permissão com o papel atual do banco", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
    mocks.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Técnico",
      email: "tech@example.com",
      role: "TECHNICIAN",
      active: true,
    });

    await expect(requirePermission("thermal-reading:simulate")).rejects.toThrow(
      "Você não tem permissão"
    );
  });
});
