import { describe, expect, it } from "vitest";
import { CART_COOKIE, parseCartCookie, serializeCart } from "./cart-cookie";

const valid = {
  productId: 7,
  slug: "lavender-dusk",
  quantity: 2,
  unitPriceCents: 1615,
};

function parseLines(lines: unknown): ReturnType<typeof parseCartCookie> {
  return parseCartCookie(JSON.stringify(lines));
}

describe("cart cookie", () => {
  it("names the cookie cart", () => {
    expect(CART_COOKIE).toBe("cart");
  });

  it("treats a missing or malformed cookie as an empty cart", () => {
    for (const v of [
      undefined,
      "",
      "not json",
      "{",
      '{"a":1}',
      '"x"',
      "null",
      "42",
      "true",
    ]) {
      expect(parseCartCookie(v)).toEqual([]);
    }
  });

  it("parses a valid cart", () => {
    expect(parseLines([valid])).toEqual([valid]);
  });

  it("drops invalid lines and keeps valid ones", () => {
    const parsed = parseLines([
      { ...valid, productId: 1, quantity: 999 },
      { ...valid, productId: 2, quantity: 0 },
      { ...valid, productId: 3, unitPriceCents: -1 },
      { ...valid, productId: "1" },
      { ...valid, productId: 4, slug: "Bad Slug" },
      valid,
    ]);

    expect(parsed).toEqual([valid]);
  });

  it("validates every field boundary", () => {
    const cases: [Record<string, unknown>, boolean][] = [
      [{ quantity: 1 }, true],
      [{ quantity: 10 }, true],
      [{ quantity: 11 }, false],
      [{ quantity: 0 }, false],
      [{ quantity: -1 }, false],
      [{ quantity: 1.5 }, false],
      [{ quantity: "2" }, false],
      [{ quantity: null }, false],
      [{ unitPriceCents: 1 }, true],
      [{ unitPriceCents: 1_000_000 }, true],
      [{ unitPriceCents: 1_000_001 }, false],
      [{ unitPriceCents: 9007199254740991 }, false],
      [{ unitPriceCents: 0 }, false],
      [{ unitPriceCents: -5 }, false],
      [{ unitPriceCents: 10.5 }, false],
      [{ unitPriceCents: "1800" }, false],
      [{ productId: 1 }, true],
      [{ productId: 0 }, false],
      [{ productId: -3 }, false],
      [{ productId: 2.5 }, false],
      [{ productId: "7" }, false],
      [{ slug: "a" }, true],
      [{ slug: "a-b-c" }, true],
      [{ slug: "Upper" }, false],
      [{ slug: "-lead" }, false],
      [{ slug: "trail-" }, false],
      [{ slug: "double--dash" }, false],
      [{ slug: "" }, false],
      [{ slug: 5 }, false],
    ];

    for (const [override, accepted] of cases) {
      expect(parseLines([{ ...valid, ...override }])).toHaveLength(
        accepted ? 1 : 0,
      );
    }
  });

  it("drops a line priced above $10,000 a unit and keeps the rest", () => {
    const tampered = {
      productId: 8,
      slug: "cedar-hearth",
      quantity: 10,
      unitPriceCents: 9007199254740991,
    };

    expect(parseLines([tampered, valid])).toEqual([valid]);
  });

  it("drops lines that are not objects", () => {
    expect(parseLines([null, 3, "x", [], [valid], valid])).toEqual([valid]);
  });

  it("drops lines with missing fields", () => {
    const { productId, slug, quantity, unitPriceCents } = valid;
    const withoutField = [
      { slug, quantity, unitPriceCents },
      { productId, quantity, unitPriceCents },
      { productId, slug, unitPriceCents },
      { productId, slug, quantity },
    ];
    for (const line of withoutField) {
      expect(parseLines([line])).toEqual([]);
    }
  });

  it("keeps only the four known fields", () => {
    const parsed = parseLines([
      { ...valid, name: "Lavender Dusk", email: "a@b.c" },
    ]);

    expect(parsed).toEqual([valid]);
    expect(Object.keys(parsed[0] ?? {}).sort()).toEqual([
      "productId",
      "quantity",
      "slug",
      "unitPriceCents",
    ]);
  });

  it("keeps the first of duplicate product lines", () => {
    const first = { ...valid, quantity: 2 };
    const second = { ...valid, quantity: 5, unitPriceCents: 999 };
    const other = { ...valid, productId: 8, slug: "cedar-hearth" };

    expect(parseLines([first, other, second])).toEqual([first, other]);
  });

  it("keeps a valid duplicate when an earlier one with the same id was invalid", () => {
    expect(parseLines([{ ...valid, quantity: 99 }, valid])).toEqual([valid]);
  });

  it("round trips a cart", () => {
    const lines = [
      valid,
      {
        productId: 9,
        slug: "cedar-hearth",
        quantity: 10,
        unitPriceCents: 2400,
      },
    ];

    expect(parseCartCookie(serializeCart(lines))).toEqual(lines);
  });

  it("round trips an empty cart", () => {
    expect(serializeCart([])).toBe("[]");
    expect(parseCartCookie(serializeCart([]))).toEqual([]);
  });

  it("serializes only the four stored fields", () => {
    const polluted = { ...valid, name: "Lavender Dusk" };

    expect(JSON.parse(serializeCart([polluted]))).toEqual([valid]);
  });

  it("never throws on hostile input", () => {
    const hostile = [
      "[".repeat(200000),
      `${"[".repeat(100000)}${"]".repeat(100000)}`,
      "x".repeat(1_000_000),
      `[${'{"a":'.repeat(50000)}1${"}".repeat(50000)}]`,
      "\u0000￾\ud800",
      "__proto__",
      '{"__proto__":{"polluted":true}}',
      '[{"__proto__":{"quantity":1}}]',
      "[1e999]",
      "[NaN]",
    ];

    for (const value of hostile) {
      expect(() => parseCartCookie(value)).not.toThrow();
      expect(parseCartCookie(value)).toEqual([]);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("accepts a very long cart of valid lines without throwing", () => {
    const lines = Array.from({ length: 5000 }, (_, i) => ({
      ...valid,
      productId: i + 1,
    }));

    expect(parseLines(lines)).toHaveLength(5000);
  });
});
