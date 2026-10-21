import express from "express";
import type { Db } from "../db/client.js";
import { parseCatalogQuery } from "./catalog-query.js";
import { createCatalogRepository } from "./catalog.repository.js";

type RawValue = string | string[] | undefined;

function stringQuery(query: Record<string, unknown>): Record<string, RawValue> {
  const result: Record<string, RawValue> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      result[key] = value;
    } else if (
      Array.isArray(value) &&
      value.every((v) => typeof v === "string")
    ) {
      result[key] = value;
    }
  }
  return result;
}

export function catalogRouter(db: Db): express.Router {
  const repository = createCatalogRepository(db);
  const router = express.Router();

  router.get("/families", async (_req, res) => {
    res.json(await repository.listFamilies());
  });

  router.get("/products", async (req, res) => {
    const query = parseCatalogQuery(stringQuery(req.query));
    res.json(await repository.listProducts(query));
  });

  router.get("/products/:slug", async (req, res) => {
    const product = await repository.findBySlug(req.params.slug);
    if (!product) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json(product);
  });

  return router;
}
