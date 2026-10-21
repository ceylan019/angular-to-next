import type { PlaceOrderActionResult } from "./place-order-action";

const DECLINED = "Your card was declined.";

const PRICE_CHANGED =
  "Prices changed for some items. Please review your order and place it again.";

const INVALID = "Please check your details and try again.";

export function outOfStockMessage(name: string): string {
  return `${name} is no longer available in the quantity you chose. We updated your cart.`;
}

export function alertMessages(result: PlaceOrderActionResult): string[] {
  switch (result.status) {
    case "declined":
      return [DECLINED];
    case "out-of-stock":
      return result.messages;
    case "price-changed":
      return [PRICE_CHANGED];
    case "invalid":
      return [INVALID];
  }
}
