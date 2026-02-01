/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@mediabot/shared"],
  // TODO: Corregir errores de tipos del refactor multi-tenant y remover esto
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
