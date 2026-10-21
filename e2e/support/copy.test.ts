import { describe, expect, it } from "vitest";
import { COPY } from "./copy.js";

function strings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(strings);
  }
  return [];
}

describe("COPY.stock", () => {
  it.each([
    [0, "Out of stock"],
    [1, "Only 1 left"],
    [2, "Only 2 left"],
    [3, "Only 3 left"],
    [4, "In stock"],
    [25, "In stock"],
  ])("shows stock %i as %s", (stock, expected) => {
    expect(COPY.stock(stock)).toBe(expected);
  });
});

describe("COPY templates", () => {
  it.each([
    [COPY.header.cart(0), "Cart (0)"],
    [COPY.header.cart(12), "Cart (12)"],
    [COPY.title.product("Fig & Cassis"), "Fig & Cassis | Wick & Co. Candles"],
    [COPY.title.order("WC-AB12CD"), "Order WC-AB12CD | Wick & Co. Candles"],
    [COPY.cart.added("Lavender Dusk"), "Added Lavender Dusk to your cart."],
    [
      COPY.cart.cap(3, "Ember & Clove"),
      "You can buy at most 3 of Ember & Clove.",
    ],
    [COPY.cart.quantityFor("Lavender Dusk"), "Quantity for Lavender Dusk"],
    [COPY.cart.removeItem("Lavender Dusk"), "Remove Lavender Dusk"],
    [
      COPY.checkout.outOfStock("Ember & Clove"),
      "Ember & Clove is no longer available in the quantity you chose. We updated your cart.",
    ],
    [COPY.checkout.summaryLine("Ember & Clove", 2), "Ember & Clove \u00d7 2"],
    [COPY.confirmation.orderNumber("WC-AB12CD"), "Order number: WC-AB12CD"],
    [COPY.confirmation.line("Honey Oat", 1), "Honey Oat \u00d7 1"],
    [COPY.confirmation.cityLine("London", "SW1A 1AA"), "London SW1A 1AA"],
    [COPY.product.burnTime(45), "Burn time: 45 hours"],
    [COPY.product.size(8), "Size: 8 oz"],
  ])("renders %s", (actual, expected) => {
    expect(actual).toBe(expected);
  });

  it("joins scent notes with a comma and a space", () => {
    expect(COPY.product.scentNotes(["lavender", "bergamot", "musk"])).toBe(
      "Scent notes: lavender, bergamot, musk",
    );
  });

  it("shows a single scent note without a separator", () => {
    expect(COPY.product.scentNotes(["cedar"])).toBe("Scent notes: cedar");
  });
});

describe("COPY strings", () => {
  const all = strings(COPY);

  it("lists the scent families in the page contract order", () => {
    expect(COPY.list.families.options).toEqual([
      "Floral",
      "Woody",
      "Fresh",
      "Gourmand",
      "Spicy",
      "Herbal",
    ]);
  });

  it("lists the cart columns in the page contract order", () => {
    expect(COPY.cart.columns).toEqual([
      "Candle",
      "Price",
      "Quantity",
      "Total",
      "Actions",
    ]);
  });

  it("names the five countries by code in the page contract order", () => {
    expect(COPY.checkout.countryPlaceholder).toBe("Select a country");
    expect(Object.entries(COPY.checkout.countries)).toEqual([
      ["US", "United States"],
      ["CA", "Canada"],
      ["GB", "United Kingdom"],
      ["DE", "Germany"],
      ["NL", "Netherlands"],
    ]);
  });

  it("uses straight apostrophes only", () => {
    expect(COPY.notFound.text).toBe("We couldn't find that page.");
    expect(
      all.filter((text) => /[\u2018\u2019\u201c\u201d]/.test(text)),
    ).toEqual([]);
  });

  it("never holds an empty or padded string", () => {
    expect(all.length).toBeGreaterThan(80);
    expect(all.filter((text) => text.trim() !== text || text === "")).toEqual(
      [],
    );
  });
});
