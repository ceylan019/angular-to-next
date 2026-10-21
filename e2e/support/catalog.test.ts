import raw from "backend/catalog.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { bySlug, CATALOG, sortedByName, sortedByPrice } from "./catalog.js";

function slugs(products: readonly { slug: string }[]): string[] {
  return products.map((product) => product.slug);
}

function pairs<T>(items: readonly T[]): [T, T][] {
  return items.slice(1).map((item, index) => [items[index] as T, item]);
}

function product(slug: string, name: string, priceCents: number) {
  return { ...bySlug("lavender-dusk"), slug, name, priceCents };
}

const MIXED = [
  product("cherry", "Cherry", 1000),
  product("apple", "apple", 500),
  product("banana", "Banana", 1000),
  product("zest", "Zest", 1500),
  product("amber", "Amber & Oak", 1000),
];

describe("CATALOG", () => {
  it("is the backend seed catalog itself", () => {
    expect(CATALOG).toBe(raw);
    expect(CATALOG).toHaveLength(30);
  });
});

describe("sortedByName", () => {
  it("orders every product by name in byte order like the backend", () => {
    const sorted = sortedByName();

    expect(sorted).toHaveLength(CATALOG.length);
    expect(new Set(slugs(sorted))).toEqual(new Set(slugs(CATALOG)));
    for (const [a, b] of pairs(sorted)) {
      expect(a.name < b.name).toBe(true);
    }
    expect(sorted[0]?.name).toBe("Birch & Pine");
    expect(sorted.at(-1)?.name).toBe("White Orchid");
  });

  it("leaves the catalog order untouched", () => {
    const before = slugs(CATALOG);

    sortedByName();

    expect(slugs(CATALOG)).toEqual(before);
    expect(sortedByName()).not.toBe(sortedByName());
  });
});

describe("sortedByName with a given list", () => {
  it("puts upper case before lower case like the C collation", () => {
    expect(slugs(sortedByName(MIXED))).toEqual([
      "amber",
      "banana",
      "cherry",
      "zest",
      "apple",
    ]);
  });

  it("leaves the given list untouched", () => {
    const before = slugs(MIXED);

    sortedByName(MIXED);

    expect(slugs(MIXED)).toEqual(before);
  });

  it("returns an empty list for an empty list", () => {
    expect(sortedByName([])).toEqual([]);
  });
});

describe("sortedByPrice with a given list", () => {
  it("breaks price ties by name even when the input order disagrees", () => {
    expect(slugs(sortedByPrice("asc", MIXED))).toEqual([
      "apple",
      "amber",
      "banana",
      "cherry",
      "zest",
    ]);
  });

  it("keeps name order inside a price tie when sorting high to low", () => {
    expect(slugs(sortedByPrice("desc", MIXED))).toEqual([
      "zest",
      "amber",
      "banana",
      "cherry",
      "apple",
    ]);
  });

  it("leaves the given list untouched", () => {
    const before = slugs(MIXED);

    sortedByPrice("desc", MIXED);

    expect(slugs(MIXED)).toEqual(before);
  });
});

describe("sortedByPrice", () => {
  it("orders from low to high price with ties broken by name", () => {
    const sorted = sortedByPrice("asc");

    expect(sorted).toHaveLength(CATALOG.length);
    expect(new Set(slugs(sorted))).toEqual(new Set(slugs(CATALOG)));
    for (const [a, b] of pairs(sorted)) {
      expect(a.priceCents).toBeLessThanOrEqual(b.priceCents);
      if (a.priceCents === b.priceCents) {
        expect(a.name < b.name).toBe(true);
      }
    }
  });

  it("orders from high to low price with ties still broken by name", () => {
    const sorted = sortedByPrice("desc");

    expect(sorted).toHaveLength(CATALOG.length);
    for (const [a, b] of pairs(sorted)) {
      expect(a.priceCents).toBeGreaterThanOrEqual(b.priceCents);
      if (a.priceCents === b.priceCents) {
        expect(a.name < b.name).toBe(true);
      }
    }
  });

  it.each(["asc", "desc"] as const)(
    "puts Lavender Dusk right before Orange Grove at the same price (%s)",
    (direction) => {
      const order = slugs(sortedByPrice(direction));
      const lavender = order.indexOf("lavender-dusk");

      expect(order[lavender + 1]).toBe("orange-grove");
    },
  );

  it("leaves the catalog order untouched", () => {
    const before = slugs(CATALOG);

    sortedByPrice("asc");
    sortedByPrice("desc");

    expect(slugs(CATALOG)).toEqual(before);
  });
});

describe("bySlug", () => {
  it("finds a product by its slug", () => {
    const product = bySlug("fig-cassis");

    expect(product.name).toBe("Fig & Cassis");
    expect(product.priceCents).toBe(1615);
  });

  it.each(["no-such-candle", "", "Fig-Cassis"])(
    "throws for the unknown slug %j",
    (slug) => {
      expect(() => bySlug(slug)).toThrow(
        `No product with slug "${slug}" in the catalog`,
      );
    },
  );
});
