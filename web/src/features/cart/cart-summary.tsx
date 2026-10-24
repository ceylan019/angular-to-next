import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TotalsList } from "./totals-list";
import type { CartTotals } from "./totals";

export function CartSummary({ totals }: { totals: CartTotals }) {
  return (
    <div className="flex flex-col gap-6 rounded-xl bg-surface p-6 shadow-sm ring-1 ring-border">
      <TotalsList totals={totals} />
      <Button asChild focus="outline" className="h-10 w-full">
        <Link href="/checkout">Checkout</Link>
      </Button>
    </div>
  );
}
