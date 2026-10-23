import { describe, expect, it } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  SHIPPING_CENTS,
  cartTotals,
} from "./totals";

describe("cartTotals", () => {
  it("[BR-C5] exposes the shipping constants", () => {
    expect(SHIPPING_CENTS).toBe(595);
    expect(FREE_SHIPPING_THRESHOLD_CENTS).toBe(5000);
  });

  it.each([
    {
      name: "charges 595 below 5000",
      lines: [
        { unitPriceCents: 2475, quantity: 1 },
        { unitPriceCents: 2500, quantity: 1 },
      ],
      totals: { subtotalCents: 4975, shippingCents: 595, totalCents: 5570 },
    },
    {
      name: "ships free at exactly 5000",
      lines: [{ unitPriceCents: 2500, quantity: 2 }],
      totals: { subtotalCents: 5000, shippingCents: 0, totalCents: 5000 },
    },
    {
      name: "ships free above 5000",
      lines: [
        { unitPriceCents: 2525, quantity: 1 },
        { unitPriceCents: 2500, quantity: 1 },
      ],
      totals: { subtotalCents: 5025, shippingCents: 0, totalCents: 5025 },
    },
    {
      name: "keeps exact cents",
      lines: [{ unitPriceCents: 1615, quantity: 1 }],
      totals: { subtotalCents: 1615, shippingCents: 595, totalCents: 2210 },
    },
    {
      name: "totals zero for an empty cart",
      lines: [],
      totals: { subtotalCents: 0, shippingCents: 0, totalCents: 0 },
    },
  ])("[BR-C5] totals: $name", ({ lines, totals }) => {
    expect(cartTotals(lines)).toEqual(totals);
  });

  it("[BR-C5] [KD-01] keeps exact cents for 1615", () => {
    expect(
      cartTotals([{ unitPriceCents: 1615, quantity: 1 }]).subtotalCents,
    ).toBe(1615);
  });

  it("[BR-C5] [KD-01] keeps exact cents where floating point dollars would truncate", () => {
    expect(cartTotals([{ unitPriceCents: 1615, quantity: 2 }])).toEqual({
      subtotalCents: 3230,
      shippingCents: 595,
      totalCents: 3825,
    });
  });

  it("[BR-C5] [KD-03] ships free at exactly 5000", () => {
    expect(
      cartTotals([{ unitPriceCents: 2500, quantity: 2 }]).shippingCents,
    ).toBe(0);
  });

  it("[BR-C5] charges 595 one cent below the threshold", () => {
    expect(cartTotals([{ unitPriceCents: 4999, quantity: 1 }])).toEqual({
      subtotalCents: 4999,
      shippingCents: 595,
      totalCents: 5594,
    });
  });

  it("[BR-C5] multiplies each unit price by its quantity before adding", () => {
    expect(
      cartTotals([
        { unitPriceCents: 1615, quantity: 3 },
        { unitPriceCents: 1800, quantity: 2 },
      ]),
    ).toEqual({ subtotalCents: 8445, shippingCents: 0, totalCents: 8445 });
  });

  it("[BR-C5] keeps large totals exact", () => {
    expect(
      cartTotals([
        { unitPriceCents: 99999, quantity: 10 },
        { unitPriceCents: 12345, quantity: 10 },
      ]),
    ).toEqual({
      subtotalCents: 1123440,
      shippingCents: 0,
      totalCents: 1123440,
    });
  });
});
