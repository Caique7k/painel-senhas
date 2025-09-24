import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Painel de Senhas - Santa Casa",
  description: "Sistema geral de senhas da Santa Casa",
  icons: { icon: "/logo-santa-casa.jpg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // só roda no cliente e em desenvolvimento
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    const originalError = console.error;
    console.error = (...args) => {
      if (typeof args[0] === "string" && args[0].includes("Hydration failed")) {
        return; // ignora esse erro
      }
      originalError(...args);
    };
  }

  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
