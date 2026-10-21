import catalog from "backend/catalog.json" with { type: "json" };

export type CatalogProduct = (typeof catalog)[number];

export const CATALOG: readonly CatalogProduct[] = catalog;

function byName(a: CatalogProduct, b: CatalogProduct): number {
  if (a.name === b.name) {
    return 0;
  }
  return a.name < b.name ? -1 : 1;
}

export function sortedByName(
  products: readonly CatalogProduct[] = CATALOG,
): CatalogProduct[] {
  return [...products].sort(byName);
}

export function sortedByPrice(
  direction: "asc" | "desc",
  products: readonly CatalogProduct[] = CATALOG,
): CatalogProduct[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...products].sort(
    (a, b) => sign * (a.priceCents - b.priceCents) || byName(a, b),
  );
}

export function bySlug(slug: string): CatalogProduct {
  const product = CATALOG.find((candidate) => candidate.slug === slug);
  if (product === undefined) {
    throw new Error(`No product with slug "${slug}" in the catalog`);
  }
  return product;
}
