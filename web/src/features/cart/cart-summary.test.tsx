import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CartSummary } from "./cart-summary";

function definitions(): (string | null)[] {
  return screen.getAllByRole("definition").map((item) => item.textContent);
}

describe("CartSummary", () => {
  it("[BR-C5] lists subtotal, shipping and total as terms and definitions", () => {
    render(
      <CartSummary
        totals={{ subtotalCents: 4975, shippingCents: 595, totalCents: 5570 }}
      />,
    );

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(
      ["Subtotal", "Shipping", "Total"],
    );
    expect(definitions()).toEqual(["$49.75", "$5.95", "$55.70"]);
  });

  it("[BR-C5] [KD-03] shows Free when shipping is zero", () => {
    render(
      <CartSummary
        totals={{ subtotalCents: 5000, shippingCents: 0, totalCents: 5000 }}
      />,
    );

    expect(definitions()).toEqual(["$50.00", "Free", "$50.00"]);
  });

  it("[BR-C5] [KD-01] shows exact cents", () => {
    render(
      <CartSummary
        totals={{ subtotalCents: 1615, shippingCents: 595, totalCents: 2210 }}
      />,
    );

    expect(definitions()).toEqual(["$16.15", "$5.95", "$22.10"]);
  });

  it("[BR-C5] formats thousands separators", () => {
    render(
      <CartSummary
        totals={{
          subtotalCents: 1123440,
          shippingCents: 0,
          totalCents: 1123440,
        }}
      />,
    );

    expect(definitions()).toEqual(["$11,234.40", "Free", "$11,234.40"]);
  });

  it("[BR-C5] links to checkout", () => {
    render(
      <CartSummary
        totals={{ subtotalCents: 1615, shippingCents: 595, totalCents: 2210 }}
      />,
    );

    expect(screen.getByRole("link", { name: "Checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
  });
});
