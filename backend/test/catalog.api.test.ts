import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CATALOG } from "../src/db/catalog.js";
import { runMigrations } from "../src/db/migrate.js";
import { resetDatabase } from "../src/db/seed.js";
import { createTestApp } from "./support/test-app.js";

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sortedNames = CATALOG.map((p) => p.name).sort(byCodeUnit);

type Item = {
  id: number;
  slug: string;
  name: string;
  family: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
};

type Page = {
  items: Item[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

describe("catalog api", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    testApp = await createTestApp();
    await runMigrations(testApp.db);
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  const get = async (path: string) => {
    const res = await request(testApp.app).get(path);
    return { status: res.status, body: res.body as unknown };
  };

  const getPage = async (path: string) => {
    const res = await get(path);
    return { status: res.status, body: res.body as Page };
  };

  const allPages = async (sort: string) => {
    const items: Item[] = [];
    for (const page of [1, 2, 3]) {
      items.push(
        ...(await getPage(`/api/products?sort=${sort}&page=${String(page)}`))
          .body.items,
      );
    }
    return items;
  };

  const expectTieBreakByName = (items: Item[]) => {
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1] as Item;
      const cur = items[i] as Item;
      if (prev.priceCents === cur.priceCents) {
        expect(byCodeUnit(prev.name, cur.name)).toBeLessThan(0);
      }
    }
  };

  it("[BR-B1] first page has 12 items of 30 sorted by name", async () => {
    const { status, body } = await getPage("/api/products");
    expect(status).toBe(200);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(12);
    expect(body.totalItems).toBe(30);
    expect(body.totalPages).toBe(3);
    expect(body.items.map((i) => i.name)).toEqual(sortedNames.slice(0, 12));
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual([
        "family",
        "id",
        "imageUrl",
        "name",
        "priceCents",
        "slug",
        "stock",
      ]);
      expect(item.imageUrl).toBe(`/images/${item.slug}.jpg`);
    }
  });

  it("[BR-B1] second page continues the name order", async () => {
    const { body } = await getPage("/api/products?page=2");
    expect(body.items.map((i) => i.name)).toEqual(sortedNames.slice(12, 24));
  });

  it("[BR-B4] page 3 has 6 items and page 4 is empty but keeps totals", async () => {
    const third = await getPage("/api/products?page=3");
    expect(third.body.items.map((i) => i.name)).toEqual(sortedNames.slice(24));
    const fourth = await getPage("/api/products?page=4");
    expect(fourth.status).toBe(200);
    expect(fourth.body.items).toEqual([]);
    expect(fourth.body.page).toBe(4);
    expect(fourth.body.totalItems).toBe(30);
    expect(fourth.body.totalPages).toBe(3);
  });

  it("[BR-B2] floral and woody together give 13 products", async () => {
    const first = await getPage("/api/products?family=floral&family=woody");
    expect(first.body.totalItems).toBe(13);
    expect(first.body.totalPages).toBe(2);
    expect(first.body.items).toHaveLength(12);
    for (const item of first.body.items) {
      expect(["floral", "woody"]).toContain(item.family);
    }
    const second = await getPage(
      "/api/products?family=floral&family=woody&page=2",
    );
    expect(second.body.items).toHaveLength(1);
  });

  it("[BR-B3] price ascending breaks ties by name", async () => {
    const all = await allPages("price-asc");
    expect(all).toHaveLength(30);
    const prices = all.map((i) => i.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const names = all.map((i) => i.name);
    expect(names.indexOf("Lavender Dusk")).toBeLessThan(
      names.indexOf("Orange Grove"),
    );
    expectTieBreakByName(all);
  });

  it("[BR-B3] price descending breaks ties by name ascending", async () => {
    const all = await allPages("price-desc");
    expect(all).toHaveLength(30);
    const prices = all.map((i) => i.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
    const names = all.map((i) => i.name);
    expect(names.indexOf("Lavender Dusk")).toBeLessThan(
      names.indexOf("Orange Grove"),
    );
    expectTieBreakByName(all);
  });

  it("[BR-B5] herbal has no products", async () => {
    const { status, body } = await getPage("/api/products?family=herbal");
    expect(status).toBe(200);
    expect(body.totalItems).toBe(0);
    expect(body.totalPages).toBe(0);
    expect(body.items).toEqual([]);
    expect(body.page).toBe(1);
  });

  it("[BR-B6] detail returns every field", async () => {
    const { status, body } = await get("/api/products/lavender-dusk");
    const entry = CATALOG.find((p) => p.slug === "lavender-dusk");
    expect(status).toBe(200);
    expect(body).toEqual({
      id: expect.any(Number) as number,
      slug: "lavender-dusk",
      name: "Lavender Dusk",
      family: "floral",
      priceCents: 1800,
      stock: 25,
      imageUrl: "/images/lavender-dusk.jpg",
      summary: entry?.summary,
      description: entry?.description,
      scentNotes: ["lavender", "bergamot", "musk"],
      burnTimeHours: 45,
      sizeOz: 8,
    });
  });

  it("[BR-B7] unknown slug is 404", async () => {
    const { status, body } = await get("/api/products/does-not-exist");
    expect(status).toBe(404);
    expect(body).toEqual({ error: "NOT_FOUND" });
  });

  it("normalizes hostile query strings", async () => {
    const { status, body } = await getPage(
      "/api/products?page=abc&sort=PRICE-ASC&family=floral&family=floral&family=nope",
    );
    expect(status).toBe(200);
    expect(body.page).toBe(1);
    expect(body.totalItems).toBe(7);
    expect(body.items.map((i) => i.name)).toEqual(
      CATALOG.filter((p) => p.family === "floral")
        .map((p) => p.name)
        .sort(byCodeUnit),
    );
  });

  it.each(["0", "-1", "1.5", "1e3", "10000"])(
    "never fails for page=%s with nested query keys",
    async (page) => {
      const { status, body } = await getPage(
        `/api/products?page=${page}&family[]=x&sort[a]=b`,
      );
      expect(status).toBe(200);
      expect(body.page).toBe(1);
      expect(body.totalItems).toBe(30);
    },
  );

  it("lists six families in canonical order", async () => {
    const { status, body } = await get("/api/families");
    expect(status).toBe(200);
    const families = body as { slug: string; name: string }[];
    expect(families.map((f) => f.slug)).toEqual([
      "floral",
      "woody",
      "fresh",
      "gourmand",
      "spicy",
      "herbal",
    ]);
    expect(families[0]).toEqual({ slug: "floral", name: "Floral" });
  });
});
