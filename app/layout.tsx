import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-barlow", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PC Finder", template: "%s · PC Finder" },
  description: "Personal Australian PC deal finder",
  robots: { index: false, follow: false }, // personal site — keep it out of search engines
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111111",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-dvh font-sans text-fg antialiased">
        <Header />
        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-8 sm:pt-12">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-xs text-muted sm:px-8">
            <span className="display text-base text-fg">PC Finder</span>
            <span>Prices from Australian retailers. Discounts measured against our own price history.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
