// Ablegen unter: app/layout.tsx (ersetzt die bisherige Datei)
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { KumpelProvider } from '@/contexts/KumpelProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hyphen",
  description: "Verein – Familie – Spiel. Spielplan, Tippspiel und Chat für Mannschaften und Freunde.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <KumpelProvider>{children}</KumpelProvider>
      </body>
    </html>
  );
}
