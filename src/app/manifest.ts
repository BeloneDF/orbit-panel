import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orbit Panel",
    short_name: "Orbit",
    description: "Controle operacional da sua infraestrutura Easypanel.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f8f9",
    theme_color: "#0a9da1",
    lang: "pt-BR",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/orbit-logo.png", sizes: "1254x1254", type: "image/png", purpose: "any" },
      { src: "/orbit-logo.png", sizes: "1254x1254", type: "image/png", purpose: "maskable" },
    ],
  };
}
