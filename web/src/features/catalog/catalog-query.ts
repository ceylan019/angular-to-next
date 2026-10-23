import { FAMILY_SLUGS, type FamilySlug } from "@/lib/backend/schemas";

export type SortKey = "name-asc" | "price-asc" | "price-desc";

export type CatalogQuery = {
  families: FamilySlug[];
  sort: SortKey;
  page: number;
};

type RawValue = string | string[] | undefined;

const DEFAULT_SORT: SortKey = "name-asc";
const FIRST_PAGE = 1;
const PAGE_PATTERN = /^[1-9]\d{0,3}$/;

const FAMILY_LABELS: Record<FamilySlug, string> = {
  floral: "Floral",
  woody: "Woody",
  fresh: "Fresh",
  gourmand: "Gourmand",
  spicy: "Spicy",
  herbal: "Herbal",
};

export const FAMILY_OPTIONS: readonly { slug: FamilySlug; label: string }[] =
  FAMILY_SLUGS.map((slug) => ({ slug, label: FAMILY_LABELS[slug] }));

export const SORT_OPTIONS: readonly { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Name: A to Z" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

function first(value: RawValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function canonicalFamilies(requested: readonly unknown[]): FamilySlug[] {
  return FAMILY_SLUGS.filter((slug) => requested.includes(slug));
}

export function toSortKey(value: string | undefined): SortKey {
  return (
    SORT_OPTIONS.find((option) => option.value === value)?.value ?? DEFAULT_SORT
  );
}

export function parseCatalogQuery(
  params: Record<string, RawValue>,
): CatalogQuery {
  const family = params["family"];
  const pageValue = first(params["page"]);
  return {
    families: canonicalFamilies(Array.isArray(family) ? family : [family]),
    sort: toSortKey(first(params["sort"])),
    page: PAGE_PATTERN.test(String(pageValue)) ? Number(pageValue) : FIRST_PAGE,
  };
}

export function toApiSearchParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const slug of canonicalFamilies(query.families)) {
    params.append("family", slug);
  }
  if (query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
  if (query.page !== FIRST_PAGE) params.set("page", String(query.page));
  return params;
}

export function catalogHref(query: CatalogQuery): string {
  const search = toApiSearchParams(query).toString();
  return search === "" ? "/" : `/?${search}`;
}

export function toggleFamily(
  query: CatalogQuery,
  slug: FamilySlug,
): CatalogQuery {
  const chosen = query.families.includes(slug);
  return {
    ...query,
    families: FAMILY_SLUGS.filter((candidate) =>
      candidate === slug ? !chosen : query.families.includes(candidate),
    ),
    page: FIRST_PAGE,
  };
}

export function withSort(query: CatalogQuery, sort: SortKey): CatalogQuery {
  return { ...query, sort, page: FIRST_PAGE };
}
