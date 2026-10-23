import express from "express";
import type { Db } from "../db/client.js";
import { getOrder, placeOrder } from "./orders.service.js";

export type OrdersRouterDeps = {
  db: Db;
  clock: () => Date;
  generateOrderNumber: () => string;
};

export function ordersRouter(deps: OrdersRouterDeps): express.Router {
  const router = express.Router();

  router.post("/orders", async (req, res) => {
    const outcome = await placeOrder(deps.db, req.body, {
      now: deps.clock(),
      generateOrderNumber: deps.generateOrderNumber,
    });
    switch (outcome.kind) {
      case "placed":
        res.status(201).json(outcome.order);
        return;
      case "invalid":
        res.status(400).json({ error: "VALIDATION", fields: outcome.fields });
        return;
      case "declined":
        res.status(402).json({ error: "CARD_DECLINED" });
        return;
      case "out-of-stock":
        res.status(409).json({ error: "OUT_OF_STOCK", items: outcome.items });
        return;
      case "price-changed":
        res.status(409).json({ error: "PRICE_CHANGED", items: outcome.items });
        return;
    }
  });

  router.get("/orders/:orderNumber", async (req, res) => {
    const order = await getOrder(deps.db, req.params.orderNumber);
    if (!order) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(order);
  });

  return router;
}
