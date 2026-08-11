export { auth as middleware } from "@/lib/auth/auth";

export const config = {
  // Protege tudo, exceto assets estáticos, a própria rota de auth e o login.
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
