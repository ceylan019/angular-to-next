import { fileURLToPath } from "node:url";
import express from "express";
import type { Config } from "./config.js";
import { catalogRouter } from "./catalog/catalog.routes.js";
import type { Db } from "./db/client.js";
import { generateOrderNumber } from "./orders/order-number.js";
import { ordersRouter } from "./orders/orders.routes.js";

const imagesDir = fileURLToPath(new URL("../public/images", import.meta.url));

export type AppDeps = {
  db: Db;
  config: Config;
  clock?: () => Date;
};

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.set("query parser", "simple");
  app.use(express.json({ limit: "100kb" }));

  app.use("/images", express.static(imagesDir));

  const api = express.Router();
  api.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  api.use(catalogRouter(deps.db));
  api.use(
    ordersRouter({
      db: deps.db,
      clock: deps.clock ?? (() => new Date()),
      generateOrderNumber,
    }),
  );
  api.use((_req, res) => {
    res.status(404).json({ error: "NOT_FOUND" });
  });

  app.use("/api", api);
  app.use(
    (
      error: { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error.status === 400) {
        res.status(400).json({ error: "VALIDATION", fields: [] });
        return;
      }
      if (error.status === 413) {
        res.status(413).json({ error: "PAYLOAD_TOO_LARGE" });
        return;
      }
      res.status(500).json({ error: "INTERNAL" });
    },
  );
  return app;
}
