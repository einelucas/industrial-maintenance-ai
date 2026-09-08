"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth/auth";

export type SignInState = { error?: string };

export async function signInAction(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/thermal-monitoring",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "E-mail ou senha inválidos." };
    }
    // NEXT_REDIRECT é lançado internamente pelo signIn em caso de sucesso — repropague.
    throw error;
  }
}
