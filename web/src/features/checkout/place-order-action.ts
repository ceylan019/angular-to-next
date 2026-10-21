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

  const rows = buildCartView(lines, await fetchCartProducts(lines));
  if (rows.length === 0) redirect("/cart");
  const shown = new Set(rows.map((row) => row.productId));
  const ordered = lines.filter((line) => shown.has(line.productId));

  const result = await placeOrder(toPlaceOrderInput(parsed.data, ordered));
  switch (result.kind) {
    case "placed":
      await writeCart([]);
      return redirect(`/order/${result.order.orderNumber}`);
    case "declined":
      return { status: "declined" };
    case "invalid":
      return { status: "invalid" };
    case "price-changed":
      await writeCart(applyPriceChanges(ordered, result.items));
      return { status: "price-changed" };
    case "out-of-stock": {
      const remaining = applyStockLimits(ordered, result.items);
      await writeCart(remaining);
      if (remaining.length === 0) redirect("/cart");
      const affected = new Set(result.items.map((item) => item.productId));
      return {
        status: "out-of-stock",
        messages: rows
          .filter((row) => affected.has(row.productId))
          .map((row) => outOfStockMessage(row.name)),
      };
    }
  }
}
