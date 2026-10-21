import { describe, expect, it } from "vitest";
import {
  lavenderDusk,
  placeOrderInput,
  productPage,
  sampleOrder,
} from "@/test/fixtures";
import {
  cardDeclinedSchema,
  familySchema,
  familySlugSchema,
  orderSchema,
  outOfStockSchema,
  placeOrderInputSchema,
  priceChangedSchema,
  productDetailSchema,
  productPageSchema,
  productSummarySchema,
  validationErrorSchema,
} from "./schemas";

type Json = Record<string, unknown>;

function without(value: object, key: string): Json {
  return Object.fromEntries(
    Object.entries(value).filter(([name]) => name !== key),
  );
}

const summary = productPage.items[0] as Json;

describe("familySlugSchema", () => {
  it.each(["floral", "woody", "fresh", "gourmand", "spicy", "herbal"])(
    "accepts %s",
    (slug) => {
      expect(familySlugSchema.safeParse(slug).success).toBe(true);
    },
  );

  it.each(["", "Floral", "citrus", "floral ", 3, null])(
    "rejects %j",
    (slug) => {
      expect(familySlugSchema.safeParse(slug).success).toBe(false);
    },
  );
});

describe("familySchema", () => {
  const valid = { slug: "woody", name: "Woody" };

  it("accepts a family", () => {
    expect(familySchema.parse(valid)).toEqual(valid);
  });

  it.each([
    ["a missing slug", without(valid, "slug")],
    ["a missing name", without(valid, "name")],
    ["an unknown slug", { ...valid, slug: "citrus" }],
    ["an empty name", { ...valid, name: "" }],
    ["a numeric name", { ...valid, name: 4 }],
  ])("rejects %s", (_label, value) => {
    expect(familySchema.safeParse(value).success).toBe(false);
  });
});

describe("productSummarySchema", () => {
  it("accepts a product summary", () => {
    expect(productSummarySchema.parse(summary)).toEqual(summary);
  });

  it("accepts a product with no stock", () => {
    expect(
      productSummarySchema.safeParse({ ...summary, stock: 0 }).success,
    ).toBe(true);
  });

  it.each(["candle", "lavender-dusk", "no-1-candle", "a-b-c"])(
    "accepts the slug %s",
    (slug) => {
      expect(productSummarySchema.safeParse({ ...summary, slug }).success).toBe(
        true,
      );
    },
  );

  it.each(["id", "slug", "name", "family", "priceCents", "stock", "imageUrl"])(
    "rejects a missing %s",
    (key) => {
      expect(
        productSummarySchema.safeParse(without(summary, key)).success,
      ).toBe(false);
    },
  );

  it.each([
    ["a zero id", { id: 0 }],
    ["a negative id", { id: -1 }],
    ["a fractional id", { id: 1.5 }],
    ["a string id", { id: "7" }],
    ["an empty slug", { slug: "" }],
    ["an uppercase slug", { slug: "Lavender-Dusk" }],
    ["a slug with spaces", { slug: "lavender dusk" }],
    ["a slug with a slash", { slug: "lavender/dusk" }],
    ["a slug starting with a hyphen", { slug: "-lavender" }],
    ["a slug ending with a hyphen", { slug: "lavender-" }],
    ["a slug with a double hyphen", { slug: "lavender--dusk" }],
    ["an empty name", { name: "" }],
    ["an unknown family", { family: "citrus" }],
    ["a zero price", { priceCents: 0 }],
    ["a negative price", { priceCents: -5 }],
    ["a fractional price", { priceCents: 16.15 }],
    ["a string price", { priceCents: "1615" }],
    ["negative stock", { stock: -1 }],
    ["fractional stock", { stock: 2.5 }],
    ["an image outside images", { imageUrl: "/files/lavender-dusk.jpg" }],
    ["an absolute image url", { imageUrl: "http://x.test/images/a.jpg" }],
    ["a png image", { imageUrl: "/images/lavender-dusk.png" }],
    ["an image without a name", { imageUrl: "/images/.jpg" }],
    ["an image with a nested path", { imageUrl: "/images/a/b.jpg" }],
    ["an image with a prefix", { imageUrl: "x/images/a.jpg" }],
    ["an image with a suffix", { imageUrl: "/images/a.jpg?x=1" }],
  ])("rejects %s", (_label, patch) => {
    expect(
      productSummarySchema.safeParse({ ...summary, ...patch }).success,
    ).toBe(false);
  });
});

describe("productDetailSchema", () => {
  it("accepts a product detail", () => {
    expect(productDetailSchema.parse(lavenderDusk)).toEqual(lavenderDusk);
  });

  it("accepts a product with no scent notes", () => {
    expect(
      productDetailSchema.safeParse({ ...lavenderDusk, scentNotes: [] })
        .success,
    ).toBe(true);
  });

  it.each([
    "summary",
    "description",
    "scentNotes",
    "burnTimeHours",
    "sizeOz",
    "priceCents",
  ])("rejects a missing %s", (key) => {
    expect(
      productDetailSchema.safeParse(without(lavenderDusk, key)).success,
    ).toBe(false);
  });

  it.each([
    ["an empty summary", { summary: "" }],
    ["an empty description", { description: "" }],
    ["scent notes that are not an array", { scentNotes: "lavender" }],
    ["an empty scent note", { scentNotes: ["lavender", ""] }],
    ["a numeric scent note", { scentNotes: [4] }],
    ["zero burn time", { burnTimeHours: 0 }],
    ["negative burn time", { burnTimeHours: -3 }],
    ["fractional burn time", { burnTimeHours: 45.5 }],
    ["zero size", { sizeOz: 0 }],
    ["negative size", { sizeOz: -8 }],
    ["fractional size", { sizeOz: 8.5 }],
  ])("rejects %s", (_label, patch) => {
    expect(
      productDetailSchema.safeParse({ ...lavenderDusk, ...patch }).success,
    ).toBe(false);
  });
});

describe("productPageSchema", () => {
  it("accepts a page", () => {
    expect(productPageSchema.parse(productPage)).toEqual(productPage);
  });

  it("accepts an empty result", () => {
    const empty = { ...productPage, items: [], totalItems: 0, totalPages: 0 };
    expect(productPageSchema.parse(empty)).toEqual(empty);
  });

  it.each(["items", "page", "pageSize", "totalItems", "totalPages"])(
    "rejects a missing %s",
    (key) => {
      expect(
        productPageSchema.safeParse(without(productPage, key)).success,
      ).toBe(false);
    },
  );

  it.each([
    ["items that are not an array", { items: {} }],
    ["an invalid item", { items: [{ id: 1 }] }],
    ["page zero", { page: 0 }],
    ["a negative page", { page: -1 }],
    ["a fractional page", { page: 1.5 }],
    ["a page size of 10", { pageSize: 10 }],
    ["a page size of 13", { pageSize: 13 }],
    ["a string page size", { pageSize: "12" }],
    ["negative total items", { totalItems: -1 }],
    ["fractional total items", { totalItems: 1.5 }],
    ["negative total pages", { totalPages: -1 }],
    ["fractional total pages", { totalPages: 0.5 }],
  ])("rejects %s", (_label, patch) => {
    expect(
      productPageSchema.safeParse({ ...productPage, ...patch }).success,
    ).toBe(false);
  });
});

describe("orderSchema", () => {
  const line = sampleOrder.lines[0] as Json;

  it("accepts an order", () => {
    expect(orderSchema.parse(sampleOrder)).toEqual(sampleOrder);
  });

  it("accepts a second address line and free shipping", () => {
    const order = {
      ...sampleOrder,
      shipping: { ...sampleOrder.shipping, line2: "Flat 2" },
      shippingCents: 0,
    };
    expect(orderSchema.parse(order)).toEqual(order);
  });

  it.each([
    "orderNumber",
    "email",
    "shipping",
    "lines",
    "subtotalCents",
    "shippingCents",
    "totalCents",
    "createdAt",
  ])("rejects a missing %s", (key) => {
    expect(orderSchema.safeParse(without(sampleOrder, key)).success).toBe(
      false,
    );
  });

  it.each(["fullName", "line1", "line2", "city", "postalCode", "country"])(
    "rejects a missing shipping %s",
    (key) => {
      const order = {
        ...sampleOrder,
        shipping: without(sampleOrder.shipping, key),
      };
      expect(orderSchema.safeParse(order).success).toBe(false);
    },
  );

  it.each([
    "productId",
    "name",
    "quantity",
    "unitPriceCents",
    "lineTotalCents",
  ])("rejects a line missing %s", (key) => {
    const order = { ...sampleOrder, lines: [without(line, key)] };
    expect(orderSchema.safeParse(order).success).toBe(false);
  });

  it.each([
    ["a lowercase order number", { orderNumber: "WC-ab12cd" }],
    ["a short order number", { orderNumber: "WC-AB12C" }],
    ["a long order number", { orderNumber: "WC-AB12CDE" }],
    ["a wrong prefix", { orderNumber: "XX-AB12CD" }],
    ["no prefix", { orderNumber: "AB12CD" }],
    ["a leading space", { orderNumber: " WC-AB12CD" }],
    ["a trailing newline", { orderNumber: "WC-AB12CD\n" }],
    ["an empty email", { email: "" }],
    ["no lines", { lines: [] }],
    ["zero subtotal", { subtotalCents: 0 }],
    ["fractional subtotal", { subtotalCents: 10.5 }],
    ["negative shipping", { shippingCents: -1 }],
    ["fractional shipping", { shippingCents: 5.5 }],
    ["zero total", { totalCents: 0 }],
    ["fractional total", { totalCents: 3825.5 }],
    ["a date only", { createdAt: "2026-10-21" }],
    ["free text as a date", { createdAt: "yesterday" }],
    ["an empty date", { createdAt: "" }],
  ])("rejects %s", (_label, patch) => {
    expect(orderSchema.safeParse({ ...sampleOrder, ...patch }).success).toBe(
      false,
    );
  });

  it.each([
    ["an empty full name", { fullName: "" }],
    ["an empty line 1", { line1: "" }],
    ["a numeric line 2", { line2: 4 }],
    ["an empty city", { city: "" }],
    ["an empty postal code", { postalCode: "" }],
    ["an empty country", { country: "" }],
  ])("rejects shipping with %s", (_label, patch) => {
    const order = {
      ...sampleOrder,
      shipping: { ...sampleOrder.shipping, ...patch },
    };
    expect(orderSchema.safeParse(order).success).toBe(false);
  });

  it.each([
    ["a zero product id", { productId: 0 }],
    ["a fractional product id", { productId: 1.5 }],
    ["an empty name", { name: "" }],
    ["zero quantity", { quantity: 0 }],
    ["a quantity above ten", { quantity: 11 }],
    ["a fractional quantity", { quantity: 1.5 }],
    ["a zero unit price", { unitPriceCents: 0 }],
    ["a fractional unit price", { unitPriceCents: 1.5 }],
    ["a zero line total", { lineTotalCents: 0 }],
    ["a fractional line total", { lineTotalCents: 1.5 }],
  ])("rejects a line with %s", (_label, patch) => {
    const order = { ...sampleOrder, lines: [{ ...line, ...patch }] };
    expect(orderSchema.safeParse(order).success).toBe(false);
  });

  it("accepts a quantity of exactly ten and exactly one", () => {
    for (const quantity of [1, 10]) {
      const order = { ...sampleOrder, lines: [{ ...line, quantity }] };
      expect(orderSchema.safeParse(order).success).toBe(true);
    }
  });
});

describe("placeOrderInputSchema", () => {
  it("accepts an order input", () => {
    expect(placeOrderInputSchema.parse(placeOrderInput)).toEqual(
      placeOrderInput,
    );
  });

  it("accepts an optional second address line", () => {
    const input = {
      ...placeOrderInput,
      shipping: { ...placeOrderInput.shipping, line2: "Flat 2" },
    };
    expect(placeOrderInputSchema.parse(input)).toEqual(input);
  });

  it.each(["US", "CA", "GB", "DE", "NL"])("accepts country %s", (country) => {
    const input = {
      ...placeOrderInput,
      shipping: { ...placeOrderInput.shipping, country },
    };
    expect(placeOrderInputSchema.safeParse(input).success).toBe(true);
  });

  it.each(["", "FR", "us", "USA"])("rejects country %j", (country) => {
    const input = {
      ...placeOrderInput,
      shipping: { ...placeOrderInput.shipping, country },
    };
    expect(placeOrderInputSchema.safeParse(input).success).toBe(false);
  });

  it.each(["contact", "shipping", "payment", "lines"])(
    "rejects a missing %s",
    (key) => {
      expect(
        placeOrderInputSchema.safeParse(without(placeOrderInput, key)).success,
      ).toBe(false);
    },
  );

  it.each(["fullName", "line1", "city", "postalCode", "country"])(
    "rejects a missing shipping %s",
    (key) => {
      const input = {
        ...placeOrderInput,
        shipping: without(placeOrderInput.shipping, key),
      };
      expect(placeOrderInputSchema.safeParse(input).success).toBe(false);
    },
  );

  it.each(["cardNumber", "expiry", "cvc"])(
    "rejects a missing payment %s",
    (key) => {
      const input = {
        ...placeOrderInput,
        payment: without(placeOrderInput.payment, key),
      };
      expect(placeOrderInputSchema.safeParse(input).success).toBe(false);
    },
  );

  it("rejects a missing email", () => {
    expect(
      placeOrderInputSchema.safeParse({ ...placeOrderInput, contact: {} })
        .success,
    ).toBe(false);
  });

  it.each(["productId", "quantity", "unitPriceCents"])(
    "rejects a line missing %s",
    (key) => {
      const input = {
        ...placeOrderInput,
        lines: [without(placeOrderInput.lines[0] as object, key)],
      };
      expect(placeOrderInputSchema.safeParse(input).success).toBe(false);
    },
  );

  it.each(["productId", "quantity", "unitPriceCents"])(
    "rejects a fractional line %s",
    (key) => {
      const input = {
        ...placeOrderInput,
        lines: [{ ...(placeOrderInput.lines[0] as object), [key]: 1.5 }],
      };
      expect(placeOrderInputSchema.safeParse(input).success).toBe(false);
    },
  );
});

describe("error body schemas", () => {
  it("accepts a validation body", () => {
    const body = { error: "VALIDATION", fields: ["contact.email"] };
    expect(validationErrorSchema.parse(body)).toEqual(body);
  });

  it.each([
    ["a wrong tag", { error: "OTHER", fields: [] }],
    ["missing fields", { error: "VALIDATION" }],
    ["non string fields", { error: "VALIDATION", fields: [1] }],
  ])("rejects a validation body with %s", (_label, body) => {
    expect(validationErrorSchema.safeParse(body).success).toBe(false);
  });

  it("accepts a declined body only with its tag", () => {
    expect(
      cardDeclinedSchema.safeParse({ error: "CARD_DECLINED" }).success,
    ).toBe(true);
    expect(cardDeclinedSchema.safeParse({ error: "OTHER" }).success).toBe(
      false,
    );
    expect(cardDeclinedSchema.safeParse({}).success).toBe(false);
  });

  it("accepts an out of stock body", () => {
    const body = {
      error: "OUT_OF_STOCK",
      items: [{ productId: 7, available: 0 }],
    };
    expect(outOfStockSchema.parse(body)).toEqual(body);
  });

  it.each([
    ["a wrong tag", { error: "PRICE_CHANGED", items: [] }],
    ["missing items", { error: "OUT_OF_STOCK" }],
    [
      "a negative availability",
      { error: "OUT_OF_STOCK", items: [{ productId: 7, available: -1 }] },
    ],
    [
      "a fractional availability",
      { error: "OUT_OF_STOCK", items: [{ productId: 7, available: 1.5 }] },
    ],
    [
      "a missing product id",
      { error: "OUT_OF_STOCK", items: [{ available: 1 }] },
    ],
    [
      "a fractional product id",
      { error: "OUT_OF_STOCK", items: [{ productId: 1.5, available: 1 }] },
    ],
  ])("rejects an out of stock body with %s", (_label, body) => {
    expect(outOfStockSchema.safeParse(body).success).toBe(false);
  });

  it("accepts a price changed body", () => {
    const body = {
      error: "PRICE_CHANGED",
      items: [{ productId: 7, unitPriceCents: 1700 }],
    };
    expect(priceChangedSchema.parse(body)).toEqual(body);
  });

  it.each([
    ["a wrong tag", { error: "OUT_OF_STOCK", items: [] }],
    ["missing items", { error: "PRICE_CHANGED" }],
    [
      "a zero price",
      { error: "PRICE_CHANGED", items: [{ productId: 7, unitPriceCents: 0 }] },
    ],
    [
      "a fractional price",
      {
        error: "PRICE_CHANGED",
        items: [{ productId: 7, unitPriceCents: 1.5 }],
      },
    ],
    [
      "a missing product id",
      { error: "PRICE_CHANGED", items: [{ unitPriceCents: 100 }] },
    ],
    [
      "a fractional product id",
      {
        error: "PRICE_CHANGED",
        items: [{ productId: 1.5, unitPriceCents: 100 }],
      },
    ],
  ])("rejects a price changed body with %s", (_label, body) => {
    expect(priceChangedSchema.safeParse(body).success).toBe(false);
  });
});
