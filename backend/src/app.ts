import express from "express";
import type { Config } from "./config.js";
import type { Db } from "./db/client.js";

export type AppDeps = {
  db: Db;
  config: Config;
  clock?: () => Date;
};

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.locals["config"] = deps.config;
  app.locals["db"] = deps.db;
  app.locals["clock"] = deps.clock ?? (() => new Date());
  app.set("query parser", "simple");
  app.use(express.json({ limit: "100kb" }));

  const api = express.Router();
  api.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  api.use((_req, res) => {
    res.status(404).json({ error: "NOT_FOUND" });
  });

  app.use("/api", api);
  return app;
}
