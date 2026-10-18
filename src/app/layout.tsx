import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/pwa-registration";

export const metadata: Metadata = {
  title: "Orbit Panel — Easypanel Control",
  description: "Controle completo da infraestrutura Easypanel.",
  applicationName: "Orbit Panel",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/orbit-logo.png", apple: "/orbit-logo.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Orbit Panel" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#0a9da1", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><PwaRegistration />{children}</body>
    </html>
  );
}
