import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatShipping, formatUsd } from "@/lib/money";
import type { CartTotals } from "./totals";

export function CartSummary({ totals }: { totals: CartTotals }) {
  return (
    <div className="flex flex-col gap-6 rounded-xl bg-surface p-6 shadow-sm ring-1 ring-border">
      <dl className="grid grid-cols-[1fr_auto] gap-y-3 text-ink">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="text-right font-medium">
          {formatUsd(totals.subtotalCents)}
        </dd>
        <dt className="text-muted-foreground">Shipping</dt>
        <dd className="text-right font-medium">
          {formatShipping(totals.shippingCents)}
        </dd>
        <dt className="border-t pt-3 font-semibold">Total</dt>
        <dd className="border-t pt-3 text-right text-lg font-semibold">
          {formatUsd(totals.totalCents)}
        </dd>
      </dl>
      <Button asChild focus="outline" className="h-10 w-full">
        <Link href="/checkout">Checkout</Link>
      </Button>
    </div>
  );
}
