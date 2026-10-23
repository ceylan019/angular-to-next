import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../src/db/migrate.js";
import { resetDatabase } from "../src/db/seed.js";
import { createTestApp } from "./support/test-app.js";

type Product = { id: number; priceCents: number; stock: number };

const order = (productId: number, unitPriceCents: number) => ({
  contact: { email: "ada@example.com" },
  shipping: {
    fullName: "Ada Lovelace",
    line1: "1 Main Street",
    city: "Springfield",
    postalCode: "12345",
    country: "US",
  },
  payment: { cardNumber: "4242424242424242", expiry: "12/99", cvc: "123" },
  lines: [{ productId, quantity: 2, unitPriceCents }],
});

describe("test mode api", () => {
  let on: Awaited<ReturnType<typeof createTestApp>>;
  let off: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    on = await createTestApp({ testMode: true });
    off = await createTestApp({ testMode: false });
    await runMigrations(on.db);
  });

  afterAll(async () => {
    await on.close();
    await off.close();
  });

  beforeEach(async () => {
    await resetDatabase(on.db);
    await request(on.app).post("/api/test/request-count/reset");
  });

  const product = async (slug: string): Promise<Product> => {
    const res = await request(on.app).get(`/api/products/${slug}`);
    return res.body as Product;
  };

  const placeOne = async () => {
    const p = await product("lavender-dusk");
    return request(on.app).post("/api/orders").send(order(p.id, p.priceCents));
  };

  it("hides every test route when test mode is off", async () => {
    const calls = [
      request(off.app).post("/api/test/reset"),
      request(off.app)
        .post("/api/test/products/lavender-dusk")
        .send({ stock: 1 }),
      request(off.app).get("/api/test/orders"),
      request(off.app).get("/api/test/request-count"),
      request(off.app).post("/api/test/request-count/reset"),
    ];
    for (const call of calls) {
      const res = await call;
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "NOT_FOUND" });
    }
  });

  it("reset restores stock after an order", async () => {
    expect((await placeOne()).status).toBe(201);
    expect((await product("lavender-dusk")).stock).toBe(23);
    const res = await request(on.app).post("/api/test/reset");
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect((await product("lavender-dusk")).stock).toBe(25);
  });

  it("reset also clears the order count and the request count", async () => {
    await placeOne();
    await request(on.app).post("/api/test/reset");
    expect((await request(on.app).get("/api/test/orders")).body).toEqual({
      count: 0,
    });
    expect((await request(on.app).get("/api/test/request-count")).body).toEqual(
      { count: 0 },
    );
  });

  it("sets stock and price for a product", async () => {
    const res = await request(on.app)
      .post("/api/test/products/lavender-dusk")
      .send({ stock: 1, priceCents: 1900 });
    expect(res.status).toBe(204);
    const p = await product("lavender-dusk");
    expect(p.stock).toBe(1);
    expect(p.priceCents).toBe(1900);
  });

  it("sets stock alone and leaves the price", async () => {
    const before = await product("lavender-dusk");
    const res = await request(on.app)
      .post("/api/test/products/lavender-dusk")
      .send({ stock: 0 });
    expect(res.status).toBe(204);
    const p = await product("lavender-dusk");
    expect(p.stock).toBe(0);
    expect(p.priceCents).toBe(before.priceCents);
  });

  it("sets price alone and leaves the stock", async () => {
    const before = await product("lavender-dusk");
    const res = await request(on.app)
      .post("/api/test/products/lavender-dusk")
      .send({ priceCents: 1234 });
    expect(res.status).toBe(204);
    const p = await product("lavender-dusk");
    expect(p.priceCents).toBe(1234);
    expect(p.stock).toBe(before.stock);
  });

  it("only changes the named product", async () => {
    const other = await product("orange-grove");
    await request(on.app)
      .post("/api/test/products/lavender-dusk")
      .send({ stock: 1, priceCents: 1900 });
    expect(await product("orange-grove")).toEqual(other);
  });

  it("rejects an empty product patch", async () => {
    const res = await request(on.app)
      .post("/api/test/products/lavender-dusk")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "VALIDATION", fields: [""] });
  });

  it.each([
    [{ stock: -1 }, "stock"],
    [{ stock: 1.5 }, "stock"],
    [{ stock: "3" }, "stock"],
    [{ priceCents: 0 }, "priceCents"],
    [{ priceCents: -5 }, "priceCents"],
    [{ priceCents: 10.5 }, "priceCents"],
    [{ priceCents: null }, "priceCents"],
  ])("rejects the product patch %j", async (body, field) => {
    const before = await product("lavender-dusk");
    const res = await request(on.app)
      .post("/api/test/products/lavender-dusk")
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "VALIDATION", fields: [field] });
    expect(await product("lavender-dusk")).toEqual(before);
  });

  it("rejects unknown keys in a product patch", async () => {
    const res = await request(on.app)
      .post("/api/test/products/lavender-dusk")
      .send({ stock: 1, name: "x" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "VALIDATION", fields: [""] });
    expect((await product("lavender-dusk")).stock).toBe(25);
  });

  it("answers 404 for an unknown slug", async () => {
    const res = await request(on.app)
      .post("/api/test/products/nope")
      .send({ stock: 1 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "NOT_FOUND" });
  });

  it("validates the body before looking up the slug", async () => {
    const res = await request(on.app).post("/api/test/products/nope").send({});
    expect(res.status).toBe(400);
  });

  it("counts orders", async () => {
    const first = await request(on.app).get("/api/test/orders");
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ count: 0 });
    await placeOne();
    expect((await request(on.app).get("/api/test/orders")).body).toEqual({
      count: 1,
    });
  });

  it("counts api requests except test and health routes", async () => {
    await request(on.app).post("/api/test/request-count/reset");
    await request(on.app).get("/api/products");
    await request(on.app).get("/api/products");
    await request(on.app).get("/api/health");
    await request(on.app).get("/api/test/orders");
    const res = await request(on.app).get("/api/test/request-count");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 2 });
    const cleared = await request(on.app).post("/api/test/request-count/reset");
    expect(cleared.status).toBe(204);
    expect((await request(on.app).get("/api/test/request-count")).body).toEqual(
      { count: 0 },
    );
  });

  it("counts failed api requests and skips images", async () => {
    await request(on.app).get("/api/products/nope");
    await request(on.app).get("/api/unknown");
    await request(on.app).get("/images/missing.png");
    expect((await request(on.app).get("/api/test/request-count")).body).toEqual(
      { count: 2 },
    );
  });

  it("keeps a separate count per app", async () => {
    await request(off.app).get("/api/products");
    expect((await request(on.app).get("/api/test/request-count")).body).toEqual(
      { count: 0 },
    );
  });
});
