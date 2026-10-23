import type { Metadata } from "next";
import { CartQuantityProvider, StatusRegion } from "@/components/status-region";
import { updateQuantity } from "@/features/cart/cart-actions";
import { CartEmpty } from "@/features/cart/cart-empty";
import { readCart } from "@/features/cart/cart-store";
import { CartSummary } from "@/features/cart/cart-summary";
import { CartTable } from "@/features/cart/cart-table";
import { buildCartView, fetchCartProducts } from "@/features/cart/cart-view";
import { cartTotals } from "@/features/cart/totals";

export const metadata: Metadata = {
  title: "Your cart | Wick & Co. Candles",
  description:
    "Hand poured candles in floral, woody, fresh, gourmand and spicy scents.",
};

export default async function CartPage() {
  const lines = await readCart();
  const rows = buildCartView(lines, await fetchCartProducts(lines));
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        Your cart
      </h1>
      <CartQuantityProvider
        key={rows.map((row) => row.productId).join(" ")}
        action={updateQuantity}
      >
        <StatusRegion />
        <div className="mt-4">
          {rows.length === 0 ? (
            <CartEmpty />
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <CartTable rows={rows} />
              <CartSummary totals={cartTotals(rows)} />
            </div>
          )}
        </div>
      </CartQuantityProvider>
    </div>
  );
}
