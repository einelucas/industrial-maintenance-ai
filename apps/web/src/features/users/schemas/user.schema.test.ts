import { describe, expect, it } from "vitest";
import { changePasswordSchema, createUserSchema, resetPasswordSchema, updateUserSchema } from "./user.schema";

describe("createUserSchema", () => {
  const valid = { name: "Fulano", email: "fulano@pcm.local", password: "senha1234", role: "TECHNICIAN" };

  it("aceita um payload válido", () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    expect(createUserSchema.safeParse({ ...valid, email: "não-é-email" }).success).toBe(false);
  });

  it("rejeita senha curta", () => {
    expect(createUserSchema.safeParse({ ...valid, password: "123" }).success).toBe(false);
  });

  it("rejeita role fora do enum", () => {
    expect(createUserSchema.safeParse({ ...valid, role: "SUPERUSER" }).success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("não exige senha", () => {
    const result = updateUserSchema.safeParse({ name: "Fulano", email: "fulano@pcm.local", role: "MANAGER" });
    expect(result.success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("aceita senha com 8+ caracteres", () => {
    expect(resetPasswordSchema.safeParse({ password: "novaSenha123" }).success).toBe(true);
  });

  it("rejeita senha curta", () => {
    expect(resetPasswordSchema.safeParse({ password: "123" }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  const valid = { currentPassword: "atual123", newPassword: "novaSenha123", confirmPassword: "novaSenha123" };

  it("aceita um payload válido (a checagem de senhas iguais é feita no service, não aqui)", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita nova senha curta", () => {
    expect(changePasswordSchema.safeParse({ ...valid, newPassword: "123", confirmPassword: "123" }).success).toBe(false);
  });

  it("rejeita senha atual vazia", () => {
    expect(changePasswordSchema.safeParse({ ...valid, currentPassword: "" }).success).toBe(false);
  });
});
