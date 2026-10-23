import { count, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { CATALOG, FAMILIES } from "./catalog.js";
import { families, products } from "./schema.js";

type Writer = Pick<Db, "insert">;

async function insertCatalog(db: Writer): Promise<void> {
  await db.insert(families).values([...FAMILIES]);
  await db.insert(products).values(
    CATALOG.map((p) => ({
      slug: p.slug,
      name: p.name,
      familySlug: p.family,
      priceCents: p.priceCents,
      stock: p.stock,
      summary: p.summary,
      description: p.description,
      scentNotes: p.scentNotes,
      burnTimeHours: p.burnTimeHours,
      sizeOz: p.sizeOz,
    })),
  );
}

export async function resetDatabase(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`truncate table order_lines, orders, products, families restart identity cascade`,
    );
    await insertCatalog(tx);
  });
}

export async function seedIfEmpty(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`lock table products in exclusive mode`);
    const [row] = await tx.select({ n: count() }).from(products);
    if ((row?.n ?? 0) === 0) {
      await tx.execute(sql`delete from families`);
      await insertCatalog(tx);
    }
  });
}
