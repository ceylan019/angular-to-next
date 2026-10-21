import { count } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../src/db/migrate.js";
import { orders } from "../src/db/schema.js";
import { resetDatabase } from "../src/db/seed.js";
import { placeOrder } from "../src/orders/orders.service.js";
import { createTestApp } from "./support/test-app.js";

type Line = { productId: number; quantity: number; unitPriceCents: number };
type Product = { id: number; priceCents: number; stock: number };

describe("orders api", () => {
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

  const product = async (slug: string): Promise<Product> => {
    const res = await request(testApp.app).get(`/api/products/${slug}`);
    return res.body as Product;
  };

  const line = async (slug: string, quantity: number, price?: number) => {
    const p = await product(slug);
    return {
      productId: p.id,
      quantity,
      unitPriceCents: price ?? p.priceCents,
    };
  };

  const body = (lines: Line[], overrides: Record<string, unknown> = {}) => ({
    contact: { email: "ada@example.com" },
    shipping: {
      fullName: "Ada Lovelace",
      line1: "1 Main Street",
      city: "Springfield",
      postalCode: "12345",
      country: "US",
    },
    payment: {
      cardNumber: "4242424242424242",
      expiry: "12/99",
      cvc: "123",
    },
    lines,
    ...overrides,
  });

  const post = (payload: unknown) =>
    request(testApp.app)
      .post("/api/orders")
      .send(payload as object);

  const orderCount = async () => {
    const [row] = await testApp.db.select({ n: count() }).from(orders);
    return row?.n ?? 0;
  };

  it("[BR-K5] places an order, decrements stock and returns totals", async () => {
    const res = await post(body([await line("lavender-dusk", 2)]));
    expect(res.status).toBe(201);
    const order = res.body as {
      orderNumber: string;
      subtotalCents: number;
      shippingCents: number;
      totalCents: number;
      createdAt: string;
    };
    expect(order.orderNumber).toMatch(/^WC-[A-Z0-9]{6}$/);
    expect(order.subtotalCents).toBe(3600);
    expect(order.shippingCents).toBe(595);
    expect(order.totalCents).toBe(4195);
    expect(new Date(order.createdAt).toISOString()).toBe(order.createdAt);
    expect((await product("lavender-dusk")).stock).toBe(23);
    const fetched = await request(testApp.app).get(
      `/api/orders/${order.orderNumber}`,
    );
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(res.body);
  });

  it("[BR-K5] returns the order with a name snapshot and lines in order", async () => {
    const lines = [
      await line("cedar-smoke", 1),
      await line("lavender-dusk", 3),
    ];
    const res = await post(body(lines));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: "ada@example.com",
      shipping: {
        fullName: "Ada Lovelace",
        line1: "1 Main Street",
        line2: null,
        city: "Springfield",
        postalCode: "12345",
        country: "US",
      },
      lines: [
        {
          productId: lines[0]?.productId,
          name: "Cedar Smoke",
          quantity: 1,
          unitPriceCents: 2500,
          lineTotalCents: 2500,
        },
        {
          productId: lines[1]?.productId,
          name: "Lavender Dusk",
          quantity: 3,
          unitPriceCents: 1800,
          lineTotalCents: 5400,
        },
      ],
      subtotalCents: 7900,
      shippingCents: 0,
      totalCents: 7900,
    });
  });

  it("[BR-C5] ships free at exactly $50.00", async () => {
    const res = await post(body([await line("cedar-smoke", 2)]));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ shippingCents: 0, totalCents: 5000 });
  });

  it("[BR-C5] charges shipping just below $50.00", async () => {
    const res = await post(body([await line("lavender-dusk", 1, 1800)]));
    expect(res.body).toMatchObject({ shippingCents: 595, totalCents: 2395 });
  });

  it("[BR-K3] declined card places nothing", async () => {
    const before = (await product("lavender-dusk")).stock;
    const res = await post(
      body([await line("lavender-dusk", 1)], {
        payment: {
          cardNumber: "4000000000000002",
          expiry: "12/99",
          cvc: "123",
        },
      }),
    );
    expect(res.status).toBe(402);
    expect(res.body).toEqual({ error: "CARD_DECLINED" });
    expect((await product("lavender-dusk")).stock).toBe(before);
    expect(await orderCount()).toBe(0);
  });

  it("[BR-K3] accepts spaces in the card number", async () => {
    const res = await post(
      body([await line("lavender-dusk", 1)], {
        payment: {
          cardNumber: "4242 4242 4242 4242",
          expiry: "12/99",
          cvc: "123",
        },
      }),
    );
    expect(res.status).toBe(201);
  });

  it("[BR-K3] validation wins over a declined card", async () => {
    const res = await post(
      body([await line("lavender-dusk", 1)], {
        payment: { cardNumber: "4000000000000002", expiry: "", cvc: "123" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("[BR-K2] invalid body lists field paths", async () => {
    const res = await post(
      body([await line("lavender-dusk", 1)], {
        shipping: {
          fullName: "Ada Lovelace",
          line1: "1 Main Street",
          city: "",
          postalCode: "12345",
          country: "US",
        },
      }),
    );
    expect(res.status).toBe(400);
    const parsed = res.body as { error: string; fields: string[] };
    expect(parsed.error).toBe("VALIDATION");
    expect(parsed.fields).toContain("shipping.city");
    expect(await orderCount()).toBe(0);
  });

  it.each([
    ["an empty object", {}],
    ["an array", []],
    ["a string", "nope"],
    ["null", null],
  ])("[BR-K2] rejects %s as a body", async (_name, payload) => {
    const res = await request(testApp.app)
      .post("/api/orders")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(payload));
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("VALIDATION");
  });

  it("[BR-K2] rejects malformed JSON", async () => {
    const res = await request(testApp.app)
      .post("/api/orders")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "VALIDATION", fields: [] });
  });

  it("[BR-K2] rejects a missing body", async () => {
    const res = await request(testApp.app).post("/api/orders");
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toBe("VALIDATION");
  });

  it("[BR-K4] rejects quantities above stock", async () => {
    const ember = await product("ember-clove");
    const res = await post(body([await line("ember-clove", 4)]));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "OUT_OF_STOCK",
      items: [{ productId: ember.id, available: 3 }],
    });
    expect((await product("ember-clove")).stock).toBe(3);
    expect(await orderCount()).toBe(0);
  });

  it("[BR-K4] accepts a quantity equal to stock", async () => {
    const res = await post(body([await line("ember-clove", 3)]));
    expect(res.status).toBe(201);
    expect((await product("ember-clove")).stock).toBe(0);
  });

  it("[BR-K4] out of stock product has 0 available", async () => {
    const jasmine = await product("midnight-jasmine");
    const res = await post(
      body([
        {
          productId: jasmine.id,
          quantity: 1,
          unitPriceCents: jasmine.priceCents,
        },
      ]),
    );
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "OUT_OF_STOCK",
      items: [{ productId: jasmine.id, available: 0 }],
    });
  });

  it("[BR-K4] unknown product counts as 0 available", async () => {
    const res = await post(
      body([{ productId: 999, quantity: 1, unitPriceCents: 1000 }]),
    );
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "OUT_OF_STOCK",
      items: [{ productId: 999, available: 0 }],
    });
  });

  it("[BR-K4] a short line leaves other lines untouched", async () => {
    const before = (await product("lavender-dusk")).stock;
    const res = await post(
      body([await line("lavender-dusk", 1), await line("ember-clove", 4)]),
    );
    expect(res.status).toBe(409);
    expect((await product("lavender-dusk")).stock).toBe(before);
  });

  it("[BR-K4] rejects a changed price", async () => {
    const lavender = await product("lavender-dusk");
    const res = await post(body([await line("lavender-dusk", 1, 1700)]));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "PRICE_CHANGED",
      items: [{ productId: lavender.id, unitPriceCents: 1800 }],
    });
    expect(lavender.stock).toBe((await product("lavender-dusk")).stock);
    expect(await orderCount()).toBe(0);
  });

  it("[BR-K4] lists only the changed price lines", async () => {
    const cedar = await product("cedar-smoke");
    const res = await post(
      body([
        await line("lavender-dusk", 1, 1700),
        await line("cedar-smoke", 1),
      ]),
    );
    expect(res.status).toBe(409);
    const lavender = await product("lavender-dusk");
    expect(res.body).toEqual({
      error: "PRICE_CHANGED",
      items: [{ productId: lavender.id, unitPriceCents: 1800 }],
    });
    expect(cedar.priceCents).toBe(2500);
  });

  it("[BR-K4] stock problems win over price problems", async () => {
    const ember = await product("ember-clove");
    const res = await post(
      body([
        await line("ember-clove", 4),
        await line("lavender-dusk", 1, 1700),
      ]),
    );
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "OUT_OF_STOCK",
      items: [{ productId: ember.id, available: 3 }],
    });
  });

  it("sells the last unit exactly once under concurrency", async () => {
    const lastLight = await line("last-light", 1);
    const [a, b] = await Promise.all([
      post(body([lastLight])),
      post(body([lastLight])),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect((await product("last-light")).stock).toBe(0);
    expect(await orderCount()).toBe(1);
  });

  it("[BR-K7] unknown order number is 404", async () => {
    const res = await request(testApp.app).get("/api/orders/WC-NOPE00");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "NOT_FOUND" });
  });

  it("[BR-K2] stores non ASCII names intact and empty line 2 as null", async () => {
    const res = await post(
      body([await line("lavender-dusk", 1)], {
        shipping: {
          fullName: "Zoë Ångström",
          line1: "1 Main Street",
          line2: "",
          city: "Springfield",
          postalCode: "12345",
          country: "US",
        },
      }),
    );
    expect(res.status).toBe(201);
    const number = (res.body as { orderNumber: string }).orderNumber;
    const fetched = await request(testApp.app).get(`/api/orders/${number}`);
    expect(fetched.body).toMatchObject({
      shipping: { fullName: "Zoë Ångström", line2: null },
    });
  });

  it("[BR-K2] stores a provided line 2", async () => {
    const res = await post(
      body([await line("lavender-dusk", 1)], {
        shipping: {
          fullName: "Ada Lovelace",
          line1: "1 Main Street",
          line2: "  Apt 4  ",
          city: "Springfield",
          postalCode: "12345",
          country: "US",
        },
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ shipping: { line2: "Apt 4" } });
  });

  it("[BR-K5] retries an order number collision", async () => {
    const first = await post(body([await line("lavender-dusk", 1)]));
    const taken = (first.body as { orderNumber: string }).orderNumber;
    const queue = [taken, taken, "WC-FRESH1"];
    const outcome = await placeOrder(
      testApp.db,
      body([await line("lavender-dusk", 1)]),
      {
        now: new Date("2026-01-01T00:00:00Z"),
        generateOrderNumber: () => queue.shift() ?? "WC-EMPTY0",
      },
    );
    expect(outcome.kind).toBe("placed");
    expect(queue).toEqual([]);
    expect(outcome.kind === "placed" && outcome.order.orderNumber).toBe(
      "WC-FRESH1",
    );
  });

  it("[BR-K5] gives up after 5 order number collisions", async () => {
    const first = await post(body([await line("lavender-dusk", 1)]));
    const taken = (first.body as { orderNumber: string }).orderNumber;
    const stockBefore = (await product("lavender-dusk")).stock;
    let calls = 0;
    await expect(
      placeOrder(testApp.db, body([await line("lavender-dusk", 1)]), {
        now: new Date("2026-01-01T00:00:00Z"),
        generateOrderNumber: () => {
          calls += 1;
          return taken;
        },
      }),
    ).rejects.toThrow();
    expect(calls).toBe(5);
    expect((await product("lavender-dusk")).stock).toBe(stockBefore);
    expect(await orderCount()).toBe(1);
  });
});
