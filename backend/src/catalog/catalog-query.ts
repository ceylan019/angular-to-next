import { FAMILY_SLUGS, type FamilySlug } from "../db/catalog.js";

export type SortKey = "name-asc" | "price-asc" | "price-desc";

export type CatalogQuery = {
  families: FamilySlug[];
  sort: SortKey;
  page: number;
};

export const PAGE_SIZE = 12;

const SORT_KEYS: readonly SortKey[] = ["name-asc", "price-asc", "price-desc"];
const PAGE_PATTERN = /^[1-9]\d{0,3}$/;

type RawValue = string | string[] | undefined;

function first(value: RawValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCatalogQuery(
  query: Record<string, RawValue>,
): CatalogQuery {
  const family = query["family"];
  const requested = Array.isArray(family) ? family : [family];
  const families = FAMILY_SLUGS.filter((slug) => requested.includes(slug));

  const sortValue = first(query["sort"]);
  const sort = SORT_KEYS.find((key) => key === sortValue) ?? "name-asc";

  const pageValue = first(query["page"]);
  const page = PAGE_PATTERN.test(String(pageValue)) ? Number(pageValue) : 1;

  return { families, sort, page };
}
