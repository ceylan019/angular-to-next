import Link from "next/link";

export function SiteHeader({ cartCount }: { cartCount: number }) {
  return (
    <header className="border-b bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-ink">
          Wick &amp; Co. Candles
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-ink hover:underline">
            Shop
          </Link>
          <Link
            href="/cart"
            className="rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground hover:bg-primary/80"
          >
            {`Cart (${String(cartCount)})`}
          </Link>
        </nav>
      </div>
    </header>
  );
}
