import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um servidor Node autocontido em .next/standalone para a imagem Docker.
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Builders com pouca RAM (como no EasyPanel) não devem abrir vários
    // workers de geração estática ao mesmo tempo.
    cpus: 1,
    memoryBasedWorkersCount: false,
  },
};

export default nextConfig;
