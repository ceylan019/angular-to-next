import { asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { families, products } from "../db/schema.js";
import type { FamilySlug } from "../db/catalog.js";
import { PAGE_SIZE, type CatalogQuery } from "./catalog-query.js";

export type ProductSummary = {
  id: number;
  slug: string;
  name: string;
  family: FamilySlug;
  priceCents: number;
  stock: number;
  imageUrl: string;
};

export type ProductDetail = ProductSummary & {
  summary: string;
  description: string;
  scentNotes: string[];
  burnTimeHours: number;
  sizeOz: number;
};

export type ProductPage = {
  items: ProductSummary[];
  page: number;
  pageSize: typeof PAGE_SIZE;
  totalItems: number;
  totalPages: number;
};

export type Family = { slug: FamilySlug; name: string };

const nameOrder = sql`${products.name} COLLATE "C"`;

function orderBy(sort: CatalogQuery["sort"]): SQL[] {
  switch (sort) {
    case "price-asc":
      return [asc(products.priceCents), asc(nameOrder)];
    case "price-desc":
      return [desc(products.priceCents), asc(nameOrder)];
    case "name-asc":
      return [asc(nameOrder)];
  }
}

type ProductRow = typeof products.$inferSelect;

function toSummary(row: ProductRow): ProductSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    family: row.familySlug as FamilySlug,
    priceCents: row.priceCents,
    stock: row.stock,
    imageUrl: `/images/${row.slug}.jpg`,
  };
}

export function createCatalogRepository(db: Db) {
  return {
    async listFamilies(): Promise<Family[]> {
      const rows = await db
        .select({ slug: families.slug, name: families.name })
        .from(families)
        .orderBy(asc(families.position));
      return rows as Family[];
    },

    async listProducts(query: CatalogQuery): Promise<ProductPage> {
      const where =
        query.families.length > 0
          ? inArray(products.familySlug, query.families)
          : undefined;

      const [totals] = await db
        .select({ total: count() })
        .from(products)
        .where(where);
      const totalItems = totals?.total ?? 0;

      const rows = await db
        .select()
        .from(products)
        .where(where)
        .orderBy(...orderBy(query.sort))
        .limit(PAGE_SIZE)
        .offset((query.page - 1) * PAGE_SIZE);

      return {
        items: rows.map(toSummary),
        page: query.page,
        pageSize: PAGE_SIZE,
        totalItems,
        totalPages: Math.ceil(totalItems / PAGE_SIZE),
      };
    },

    async findBySlug(slug: string): Promise<ProductDetail | undefined> {
      const [row] = await db
        .select()
        .from(products)
        .where(eq(products.slug, slug))
        .limit(1);
      if (!row) return undefined;
      return {
        ...toSummary(row),
        summary: row.summary,
        description: row.description,
        scentNotes: row.scentNotes,
        burnTimeHours: row.burnTimeHours,
        sizeOz: row.sizeOz,
      };
    },
  };
}
