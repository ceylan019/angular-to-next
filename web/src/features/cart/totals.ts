export const SHIPPING_CENTS = 595;
export const FREE_SHIPPING_THRESHOLD_CENTS = 5000;

export type CartTotals = {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
};

export function cartTotals(
  lines: { unitPriceCents: number; quantity: number }[],
): CartTotals {
  if (lines.length === 0) {
    return { subtotalCents: 0, shippingCents: 0, totalCents: 0 };
  }
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );
  const shippingCents =
    subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;
  return {
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
  };
}
