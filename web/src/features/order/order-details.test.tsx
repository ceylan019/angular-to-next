import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/backend/schemas";
import { OrderDetails } from "./order-details";

const order: Order = {
  orderNumber: "WC-ABC123",
  email: "ada@example.com",
  shipping: {
    fullName: "Ada Lovelace",
    line1: "12 Analytical Way",
    line2: null,
    city: "London",
    postalCode: "SW1A 1AA",
    country: "GB",
  },
  lines: [
    {
      productId: 7,
      name: "Lavender Dusk",
      quantity: 2,
      unitPriceCents: 1800,
      lineTotalCents: 3600,
    },
  ],
  subtotalCents: 3600,
  shippingCents: 0,
  totalCents: 3600,
  createdAt: "2026-10-21T09:30:00.000Z",
};

function withShipping(shipping: Partial<Order["shipping"]>): Order {
  return { ...order, shipping: { ...order.shipping, ...shipping } };
}

function items(): (string | null)[][] {
  return within(screen.getByRole("list", { name: "Items" }))
    .getAllByRole("listitem")
    .map((item) => [...item.children].map((part) => part.textContent));
}

function terms(): (string | null)[] {
  return screen.getAllByRole("term").map((term) => term.textContent);
}

function definitions(): (string | null)[] {
  return screen
    .getAllByRole("definition")
    .map((definition) => definition.textContent);
}

function shippingTo(): HTMLElement {
  return screen.getByRole("heading", { level: 2, name: "Shipping to" });
}

function addressLines(): (string | null)[] {
  const address = shippingTo().nextElementSibling;
  expect(address?.tagName).toBe("ADDRESS");
  return [...(address?.children ?? [])].map((line) => line.textContent);
}

describe("OrderDetails", () => {
  it("[BR-K5] shows order number, items, totals and address", () => {
    render(<OrderDetails order={order} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Thank you for your order",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Order number: WC-ABC123", { exact: true }),
    ).toBeInTheDocument();
    expect(items()).toEqual([["Lavender Dusk × 2", "$36.00"]]);
    expect(terms()).toEqual(["Subtotal", "Shipping", "Total"]);
    expect(definitions()).toEqual(["$36.00", "Free", "$36.00"]);
    expect(shippingTo()).toBeInTheDocument();
    expect(addressLines()).toEqual([
      "Ada Lovelace",
      "12 Analytical Way",
      "London SW1A 1AA",
      "United Kingdom",
    ]);
    expect(
      screen.getByRole("link", { name: "Continue shopping" }),
    ).toHaveAttribute("href", "/");
  });

  it("omits address line 2 when absent", () => {
    render(<OrderDetails order={withShipping({ line2: null })} />);

    expect(addressLines()).toEqual([
      "Ada Lovelace",
      "12 Analytical Way",
      "London SW1A 1AA",
      "United Kingdom",
    ]);
  });

  it("[BR-K5] treats an empty address line 2 as absent", () => {
    render(<OrderDetails order={withShipping({ line2: "" })} />);

    expect(addressLines()).toEqual([
      "Ada Lovelace",
      "12 Analytical Way",
      "London SW1A 1AA",
      "United Kingdom",
    ]);
  });

  it("[BR-K5] shows address line 2 between line 1 and the city when present", () => {
    render(<OrderDetails order={withShipping({ line2: "Flat 2" })} />);

    expect(addressLines()).toEqual([
      "Ada Lovelace",
      "12 Analytical Way",
      "Flat 2",
      "London SW1A 1AA",
      "United Kingdom",
    ]);
  });

  it("[BR-K5] shows the shipping charge the backend applied", () => {
    render(
      <OrderDetails
        order={{
          ...order,
          lines: [
            {
              productId: 7,
              name: "Lavender Dusk",
              quantity: 1,
              unitPriceCents: 1615,
              lineTotalCents: 1615,
            },
          ],
          subtotalCents: 1615,
          shippingCents: 595,
          totalCents: 2210,
        }}
      />,
    );

    expect(items()).toEqual([["Lavender Dusk × 1", "$16.15"]]);
    expect(definitions()).toEqual(["$16.15", "$5.95", "$22.10"]);
  });

  it("[BR-K5] takes line totals and totals from the backend instead of adding them up", () => {
    render(
      <OrderDetails
        order={{
          ...order,
          lines: [
            {
              productId: 7,
              name: "Lavender Dusk",
              quantity: 2,
              unitPriceCents: 1800,
              lineTotalCents: 3500,
            },
          ],
          subtotalCents: 3400,
          shippingCents: 600,
          totalCents: 4100,
        }}
      />,
    );

    expect(items()).toEqual([["Lavender Dusk × 2", "$35.00"]]);
    expect(definitions()).toEqual(["$34.00", "$6.00", "$41.00"]);
  });

  it("[BR-K5] lists every line in backend order with thousands separators", () => {
    render(
      <OrderDetails
        order={{
          ...order,
          lines: [
            {
              productId: 12,
              name: "Ember & Clove",
              quantity: 10,
              unitPriceCents: 12345,
              lineTotalCents: 123450,
            },
            {
              productId: 7,
              name: "Lavender Dusk",
              quantity: 1,
              unitPriceCents: 1800,
              lineTotalCents: 1800,
            },
            {
              productId: 3,
              name: "Lavender Dusk",
              quantity: 1,
              unitPriceCents: 1800,
              lineTotalCents: 1800,
            },
          ],
          subtotalCents: 127050,
          shippingCents: 0,
          totalCents: 127050,
        }}
      />,
    );

    expect(items()).toEqual([
      ["Ember & Clove × 10", "$1,234.50"],
      ["Lavender Dusk × 1", "$18.00"],
      ["Lavender Dusk × 1", "$18.00"],
    ]);
    expect(definitions()).toEqual(["$1,270.50", "Free", "$1,270.50"]);
  });

  it.each([
    ["US", "United States"],
    ["CA", "Canada"],
    ["GB", "United Kingdom"],
    ["DE", "Germany"],
    ["NL", "Netherlands"],
    ["FR", "FR"],
  ])("[BR-K5] names the country %s as %s", (country, name) => {
    render(<OrderDetails order={withShipping({ country })} />);

    expect(addressLines().at(-1)).toBe(name);
  });

  it("[BR-K5] shows non ASCII names and addresses intact", () => {
    render(
      <OrderDetails
        order={withShipping({
          fullName: "Zoë Ångström",
          line1: "5 Åkerbärsvägen",
          city: "Malmö",
          postalCode: "211 22",
          country: "NL",
        })}
      />,
    );

    expect(addressLines()).toEqual([
      "Zoë Ångström",
      "5 Åkerbärsvägen",
      "Malmö 211 22",
      "Netherlands",
    ]);
  });

  it("[BR-K5] shows only what the confirmation lists", () => {
    const { container } = render(<OrderDetails order={order} />);

    expect(container).not.toHaveTextContent("ada@example.com");
    expect(container).not.toHaveTextContent("$18.00");
    expect(container).not.toHaveTextContent("2026");
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual([
      "Thank you for your order",
      "Shipping to",
    ]);
    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
