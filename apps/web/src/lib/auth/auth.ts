import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";
import type { UserRole } from "@prisma/client";

// Módulo augmentation apenas para next-auth (estável); o tipo interno de JWT
// do beta v5 é acessado via cast local nos callbacks abaixo, evitando
// depender de "next-auth/jwt" como caminho de augmentation (instável em
// algumas combinações de moduleResolution/beta).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    };
  }
  interface User {
    role: UserRole;
  }
}

interface AppJWT {
  id?: string;
  role?: UserRole;
  [key: string]: unknown;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const appToken = token as AppJWT;
      if (user) {
        appToken.id = user.id;
        appToken.role = (user as { role: UserRole }).role;
      }
      return appToken;
    },
    async session({ session, token }) {
      const appToken = token as AppJWT;
      if (appToken.id) session.user.id = appToken.id;
      if (appToken.role) session.user.role = appToken.role;
      return session;
    },
  },
});
