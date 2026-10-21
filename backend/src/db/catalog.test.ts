import { describe, expect, it } from "vitest";
import { CATALOG, FAMILIES } from "./catalog.js";

const FIXTURES = [
  {
    slug: "lavender-dusk",
    name: "Lavender Dusk",
    family: "floral",
    priceCents: 1800,
    stock: 25,
  },
  {
    slug: "orange-grove",
    name: "Orange Grove",
    family: "fresh",
    priceCents: 1800,
    stock: 25,
  },
  {
    slug: "sea-salt-cedar",
    name: "Sea Salt & Cedar",
    family: "fresh",
    priceCents: 2250,
    stock: 25,
  },
  {
    slug: "vanilla-ember",
    name: "Vanilla Ember",
    family: "gourmand",
    priceCents: 1600,
    stock: 25,
  },
  {
    slug: "cedar-smoke",
    name: "Cedar Smoke",
    family: "woody",
    priceCents: 2500,
    stock: 20,
  },
  {
    slug: "honey-oat",
    name: "Honey Oat",
    family: "gourmand",
    priceCents: 2475,
    stock: 20,
  },
  {
    slug: "rose-quartz",
    name: "Rose Quartz",
    family: "floral",
    priceCents: 2525,
    stock: 20,
  },
  {
    slug: "fig-cassis",
    name: "Fig & Cassis",
    family: "floral",
    priceCents: 1615,
    stock: 25,
  },
  {
    slug: "ember-clove",
    name: "Ember & Clove",
    family: "spicy",
    priceCents: 2000,
    stock: 3,
  },
  {
    slug: "midnight-jasmine",
    name: "Midnight Jasmine",
    family: "floral",
    priceCents: 2600,
    stock: 0,
  },
  {
    slug: "last-light",
    name: "Last Light",
    family: "woody",
    priceCents: 2200,
    stock: 1,
  },
];

function countBy<T>(items: readonly T[], key: keyof T): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = String(item[key]);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]| - `);

describe("seed catalog invariants", () => {
  it("has 30 products", () => {
    expect(CATALOG).toHaveLength(30);
  });

  it("has the planned family counts with herbal empty", () => {
    expect(countBy(CATALOG, "family")).toEqual({
      floral: 7,
      woody: 6,
      fresh: 6,
      gourmand: 6,
      spicy: 5,
    });
  });

  it("lists the families in canonical order including herbal", () => {
    expect(FAMILIES).toEqual([
      { slug: "floral", name: "Floral", position: 1 },
      { slug: "woody", name: "Woody", position: 2 },
      { slug: "fresh", name: "Fresh", position: 3 },
      { slug: "gourmand", name: "Gourmand", position: 4 },
      { slug: "spicy", name: "Spicy", position: 5 },
      { slug: "herbal", name: "Herbal", position: 6 },
    ]);
  });

  it("contains every fixture exactly", () => {
    for (const fixture of FIXTURES) {
      expect(CATALOG).toContainEqual(expect.objectContaining(fixture));
    }
  });

  it("pins the lavender dusk details", () => {
    expect(CATALOG).toContainEqual(
      expect.objectContaining({
        slug: "lavender-dusk",
        summary: "A calm floral blend of lavender and soft musk.",
        scentNotes: ["lavender", "bergamot", "musk"],
        burnTimeHours: 45,
        sizeOz: 8,
      }),
    );
  });

  it("prices are multiples of 25 cents except fig cassis", () => {
    for (const p of CATALOG.filter((p) => p.slug !== "fig-cassis")) {
      expect(p.priceCents % 25).toBe(0);
    }
  });

  it("prices stay between 1200 and 3800", () => {
    for (const p of CATALOG) {
      expect(p.priceCents).toBeGreaterThanOrEqual(1200);
      expect(p.priceCents).toBeLessThanOrEqual(3800);
    }
  });

  it("only fixtures have stock below 10", () => {
    const low = CATALOG.filter((p) => p.stock < 10)
      .map((p) => p.slug)
      .sort();
    expect(low).toEqual(["ember-clove", "last-light", "midnight-jasmine"]);
  });

  it("slugs and names are unique and slugs are kebab case", () => {
    expect(new Set(CATALOG.map((p) => p.slug)).size).toBe(CATALOG.length);
    expect(new Set(CATALOG.map((p) => p.name)).size).toBe(CATALOG.length);
    for (const p of CATALOG) {
      expect(p.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("names use only ASCII letters, spaces and ampersands", () => {
    for (const p of CATALOG) {
      expect(p.name).toMatch(/^[A-Za-z &]+$/);
    }
  });

  it("scent notes, burn time and size are within range", () => {
    for (const p of CATALOG) {
      expect(p.scentNotes.length).toBeGreaterThanOrEqual(2);
      expect(p.scentNotes.length).toBeLessThanOrEqual(4);
      for (const note of p.scentNotes) {
        expect(note.trim()).not.toBe("");
      }
      expect(p.burnTimeHours).toBeGreaterThanOrEqual(30);
      expect(p.burnTimeHours).toBeLessThanOrEqual(80);
      expect(p.sizeOz).toBeGreaterThanOrEqual(6);
      expect(p.sizeOz).toBeLessThanOrEqual(16);
    }
  });

  it("every product has a known family, integer numbers and copy", () => {
    const known = FAMILIES.map((f) => f.slug);
    for (const p of CATALOG) {
      expect(known).toContain(p.family);
      expect(Number.isInteger(p.priceCents)).toBe(true);
      expect(Number.isInteger(p.stock)).toBe(true);
      expect(p.summary.trim()).not.toBe("");
      expect(p.description.trim()).not.toBe("");
    }
  });

  it("user visible copy has no em dash, en dash or spaced hyphen", () => {
    for (const p of CATALOG) {
      for (const text of [p.name, p.summary, p.description, ...p.scentNotes]) {
        expect(text).not.toMatch(DASHES);
      }
    }
  });
});
