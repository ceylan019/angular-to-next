import { count, eq } from "drizzle-orm";
import express from "express";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { orders, products } from "../db/schema.js";
import { resetDatabase } from "../db/seed.js";
import { validationFieldPaths } from "../orders/order.schema.js";
import type { RequestCounter } from "./request-counter.js";

export type TestRouterDeps = {
  db: Db;
  counter: RequestCounter;
};

const productPatchSchema = z
  .object({
    stock: z.number().int().min(0).optional(),
    priceCents: z.number().int().positive().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0);

export function testRouter(deps: TestRouterDeps): express.Router {
  const router = express.Router();

  router.post("/reset", async (_req, res) => {
    await resetDatabase(deps.db);
    deps.counter.reset();
    res.status(204).end();
  });

  router.post("/products/:slug", async (req, res) => {
    const parsed = productPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "VALIDATION",
        fields: validationFieldPaths(parsed.error),
      });
      return;
    }
    const updated = await deps.db
      .update(products)
      .set(parsed.data)
      .where(eq(products.slug, req.params.slug))
      .returning({ id: products.id });
    if (updated.length === 0) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.status(204).end();
  });

  router.get("/orders", async (_req, res) => {
    const [row] = await deps.db.select({ value: count() }).from(orders);
    res.json({ count: row?.value ?? 0 });
  });

  router.get("/request-count", (_req, res) => {
    res.json({ count: deps.counter.count() });
  });

  router.post("/request-count/reset", (_req, res) => {
    deps.counter.reset();
    res.status(204).end();
  });

  return router;
}
