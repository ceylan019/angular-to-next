import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wick & Co. Candles",
  description:
    "Hand poured candles in floral, woody, fresh, gourmand and spicy scents.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b bg-surface">
          <div className="mx-auto flex max-w-6xl items-center px-4 py-4">
            <Link href="/" className="text-lg font-semibold text-ink">
              Wick &amp; Co. Candles
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
