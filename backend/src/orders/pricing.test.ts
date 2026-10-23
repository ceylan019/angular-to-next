import { describe, expect, it } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  MAX_QUANTITY_PER_LINE,
  SHIPPING_CENTS,
  computeTotals,
} from "./pricing.js";

describe("pricing", () => {
  it("[BR-C5] exposes the business constants", () => {
    expect(SHIPPING_CENTS).toBe(595);
    expect(FREE_SHIPPING_THRESHOLD_CENTS).toBe(5000);
    expect(MAX_QUANTITY_PER_LINE).toBe(10);
  });

  it("[BR-C5] charges 595 below 5000", () => {
    expect(
      computeTotals([
        { unitPriceCents: 2475, quantity: 1 },
        { unitPriceCents: 2500, quantity: 1 },
      ]),
    ).toEqual({ subtotalCents: 4975, shippingCents: 595, totalCents: 5570 });
  });

  it("[BR-C5] charges 595 at 4999", () => {
    expect(
      computeTotals([{ unitPriceCents: 4999, quantity: 1 }]).shippingCents,
    ).toBe(595);
  });

  it("[BR-C5] ships free at exactly 5000", () => {
    expect(computeTotals([{ unitPriceCents: 2500, quantity: 2 }])).toEqual({
      subtotalCents: 5000,
      shippingCents: 0,
      totalCents: 5000,
    });
  });

  it("[BR-C5] ships free above 5000", () => {
    expect(
      computeTotals([
        { unitPriceCents: 2525, quantity: 1 },
        { unitPriceCents: 2500, quantity: 1 },
      ]).shippingCents,
    ).toBe(0);
  });

  it("[BR-C5] keeps exact cents", () => {
    expect(computeTotals([{ unitPriceCents: 1615, quantity: 1 }])).toEqual({
      subtotalCents: 1615,
      shippingCents: 595,
      totalCents: 2210,
    });
  });

  it("[BR-C5] multiplies price by quantity", () => {
    expect(computeTotals([{ unitPriceCents: 1615, quantity: 3 }])).toEqual({
      subtotalCents: 4845,
      shippingCents: 595,
      totalCents: 5440,
    });
  });

  it("[BR-C5] empty cart totals zero", () => {
    expect(computeTotals([])).toEqual({
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
    });
  });
});
