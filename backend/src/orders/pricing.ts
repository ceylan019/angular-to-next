export const SHIPPING_CENTS = 595;
export const FREE_SHIPPING_THRESHOLD_CENTS = 5000;
export const MAX_QUANTITY_PER_LINE = 10;

export type PricedLine = { unitPriceCents: number; quantity: number };

export type Totals = {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
};

export function computeTotals(lines: PricedLine[]): Totals {
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
