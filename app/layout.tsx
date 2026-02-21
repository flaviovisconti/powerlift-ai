import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Configurazione per trasformare il sito in una vera App (PWA)
export const metadata: Metadata = {
  title: "VBT Tracker AI",
  description: "Smart Squat & VBT Analyzer con IA e Bluetooth",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VBT Tracker",
  },
};

// Blocca lo zoom accidentale quando tocchi i tasti velocemente
export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={inter.className}>{children}</body>
    </html>
  );
}