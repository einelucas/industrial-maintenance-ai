/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite validar build de produção sem sobrescrever o cache de um `next dev`
  // que esteja sendo usado no ensaio da demonstração.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    // O driver Neon usa `ws` apenas no servidor. Mantê-lo externo evita que o
    // webpack transforme os módulos opcionais `bufferutil`/`utf-8-validate`,
    // o que interrompia o processo de desenvolvimento e fazia os assets CSS
    // e JS de `/_next/static` responderem 404.
    serverComponentsExternalPackages: [
      "@neondatabase/serverless",
      "@prisma/adapter-neon",
      "ws",
    ],
  },
};

export default nextConfig;
