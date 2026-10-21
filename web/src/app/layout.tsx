import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { cartCount } from "@/features/cart/cart-rules";
import { readCart } from "@/features/cart/cart-store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wick & Co. Candles",
  description:
    "Hand poured candles in floral, woody, fresh, gourmand and spicy scents.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const lines = await readCart();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <SiteHeader cartCount={cartCount(lines)} />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
