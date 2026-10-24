import Link from "next/link";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header-foreground";

export function SiteHeader({ cartCount }: { cartCount: number }) {
  return (
    <header className="bg-header text-header-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className={`rounded-sm text-lg font-semibold ${FOCUS}`}>
          Wick &amp; Co. Candles
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4 text-sm">
          <Link href="/" className={`rounded-sm hover:underline ${FOCUS}`}>
            Shop
          </Link>
          <Link
            href="/cart"
            className={`rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_20%)] ${FOCUS}`}
          >
            {`Cart (${String(cartCount)})`}
          </Link>
        </nav>
      </div>
    </header>
  );
}
