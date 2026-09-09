/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite validar build de produção sem sobrescrever o cache de um `next dev`
  // que esteja sendo usado no ensaio da demonstração.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
