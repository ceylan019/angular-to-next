"use server";

import { redirect } from "next/navigation";
import {
  applyPriceChanges,
  applyStockLimits,
} from "@/features/cart/cart-rules";
import { readCart, writeCart } from "@/features/cart/cart-store";
import { buildCartView, fetchCartProducts } from "@/features/cart/cart-view";
import { placeOrder } from "@/lib/backend/client";
import { outOfStockMessage } from "./checkout-messages";
import {
  buildCheckoutSchema,
  toPlaceOrderInput,
  type CheckoutValues,
} from "./checkout-schema";

export type PlaceOrderActionResult =
  | { status: "declined" }
  | { status: "out-of-stock"; messages: string[] }
  | { status: "price-changed" }
  | { status: "invalid" };

export async function placeOrderAction(
  values: CheckoutValues,
): Promise<PlaceOrderActionResult> {
  const lines = await readCart();
  if (lines.length === 0) redirect("/cart");

  const parsed = buildCheckoutSchema(new Date()).safeParse(values);
  if (!parsed.success) return { status: "invalid" };

  const result = await placeOrder(toPlaceOrderInput(parsed.data, lines));
  switch (result.kind) {
    case "placed":
      await writeCart([]);
      return redirect(`/order/${result.order.orderNumber}`);
    case "declined":
      return { status: "declined" };
    case "invalid":
      return { status: "invalid" };
    case "price-changed":
      await writeCart(applyPriceChanges(lines, result.items));
      return { status: "price-changed" };
    case "out-of-stock": {
      const remaining = applyStockLimits(lines, result.items);
      await writeCart(remaining);
      if (remaining.length === 0) redirect("/cart");
      const affected = lines.filter((line) =>
        result.items.some((item) => item.productId === line.productId),
      );
      const rows = buildCartView(affected, await fetchCartProducts(affected));
      return {
        status: "out-of-stock",
        messages: rows.map((row) => outOfStockMessage(row.name)),
      };
    }
  }
}
