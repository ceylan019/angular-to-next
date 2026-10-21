import { count, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CATALOG } from "../src/db/catalog.js";
import type { Db } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { families, orderLines, orders, products } from "../src/db/schema.js";
import { resetDatabase, seedIfEmpty } from "../src/db/seed.js";
import { createTestApp } from "./support/test-app.js";

describe("seed", () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const testApp = await createTestApp();
    db = testApp.db;
    close = testApp.close;
    await runMigrations(db);
  });

  afterAll(async () => {
    await close();
  });

  it("resets to 30 products with ids in catalog order and no orders", async () => {
    await resetDatabase(db);
    const rows = await db
      .select({ id: products.id, slug: products.slug })
      .from(products)
      .orderBy(products.id);
    expect(rows.map((r) => [r.id, r.slug])).toEqual(
      CATALOG.map((p, i) => [i + 1, p.slug]),
    );
    const [orderCount] = await db.select({ n: count() }).from(orders);
    expect(orderCount?.n).toBe(0);
  });

  it("reset is repeatable", async () => {
    await resetDatabase(db);
    await resetDatabase(db);
    const [productCount] = await db.select({ n: count() }).from(products);
    const [familyCount] = await db.select({ n: count() }).from(families);
    expect(productCount?.n).toBe(30);
    expect(familyCount?.n).toBe(6);
  });

  it("reset stores the catalog values", async () => {
    await resetDatabase(db);
    const [row] = await db
      .select()
      .from(products)
      .where(eq(products.slug, "lavender-dusk"));
    expect(row).toMatchObject({
      id: 1,
      name: "Lavender Dusk",
      familySlug: "floral",
      priceCents: 1800,
      stock: 25,
      scentNotes: ["lavender", "bergamot", "musk"],
      burnTimeHours: 45,
      sizeOz: 8,
    });
  });

  it("reset restores changed stock and clears orders", async () => {
    await resetDatabase(db);
    await db.update(products).set({ stock: 0 }).where(eq(products.id, 1));
    const [order] = await db
      .insert(orders)
      .values({
        orderNumber: "WC-AAAAAA",
        email: "a@b.co",
        fullName: "A B",
        line1: "1 Road",
        city: "Town",
        postalCode: "12345",
        country: "US",
        subtotalCents: 1800,
        shippingCents: 595,
        totalCents: 2395,
      })
      .returning({ id: orders.id });
    await db.insert(orderLines).values({
      orderId: order?.id ?? 0,
      productId: 1,
      productName: "Lavender Dusk",
      quantity: 1,
      unitPriceCents: 1800,
      lineTotalCents: 1800,
    });
    await resetDatabase(db);
    const [row] = await db.select().from(products).where(eq(products.id, 1));
    expect(row?.stock).toBe(25);
    const [orderCount] = await db.select({ n: count() }).from(orders);
    const [lineCount] = await db.select({ n: count() }).from(orderLines);
    expect(orderCount?.n).toBe(0);
    expect(lineCount?.n).toBe(0);
  });

  it("seedIfEmpty seeds an empty database", async () => {
    await resetDatabase(db);
    await db.delete(products);
    await db.delete(families);
    await seedIfEmpty(db);
    const [productCount] = await db.select({ n: count() }).from(products);
    expect(productCount?.n).toBe(30);
  });

  it("seedIfEmpty leaves existing data alone", async () => {
    await resetDatabase(db);
    await db.update(products).set({ stock: 7 }).where(eq(products.id, 1));
    await seedIfEmpty(db);
    const [row] = await db.select().from(products).where(eq(products.id, 1));
    expect(row?.stock).toBe(7);
  });

  it("runMigrations is idempotent", async () => {
    await runMigrations(db);
    await runMigrations(db);
    const applied = await db.execute(
      sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
    );
    expect(applied.rows[0]?.["n"]).toBe(1);
    const tables = await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    expect(tables.rows.map((r) => r["table_name"])).toEqual([
      "families",
      "order_lines",
      "orders",
      "products",
    ]);
  });

  it("rejects invalid rows through check constraints", async () => {
    await resetDatabase(db);
    await expect(
      db.update(products).set({ stock: -1 }).where(eq(products.id, 1)),
    ).rejects.toThrow();
    await expect(
      db.update(products).set({ priceCents: 0 }).where(eq(products.id, 1)),
    ).rejects.toThrow();
    await expect(
      db.update(products).set({ name: "Honey Oat" }).where(eq(products.id, 1)),
    ).rejects.toThrow();
  });
});
