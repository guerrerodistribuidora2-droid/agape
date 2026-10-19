import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ágape — Conexión humana real",
  description: "Noches cuidadas para conectar en persona en Quito.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
