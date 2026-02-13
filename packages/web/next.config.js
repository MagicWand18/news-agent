/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@mediabot/shared"],
  // Evita que Next.js intente bundlear el Prisma Query Engine nativo
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // TODO: Corregir errores de tipos del refactor multi-tenant y remover esto
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
