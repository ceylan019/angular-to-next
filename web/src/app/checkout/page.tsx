import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readCart } from "@/features/cart/cart-store";
import { buildCartView, fetchCartProducts } from "@/features/cart/cart-view";
import { cartTotals } from "@/features/cart/totals";
import { CheckoutForm } from "@/features/checkout/checkout-form";
import { OrderSummary } from "@/features/checkout/order-summary";
import { placeOrderAction } from "@/features/checkout/place-order-action";

export const metadata: Metadata = {
  title: "Checkout | Wick & Co. Candles",
  description:
    "Hand poured candles in floral, woody, fresh, gourmand and spicy scents.",
};

export default async function CheckoutPage() {
  const lines = await readCart();
  const rows = buildCartView(lines, await fetchCartProducts(lines));
  if (rows.length === 0) redirect("/cart");
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        Checkout
      </h1>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <CheckoutForm action={placeOrderAction} />
        <OrderSummary rows={rows} totals={cartTotals(rows)} />
      </div>
    </div>
  );
}
