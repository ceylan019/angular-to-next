import type { Metadata } from "next";
import { StatusRegion, StatusRegionProvider } from "@/components/status-region";
import { addToCart } from "@/features/cart/cart-actions";
import { EmptyPage, NoMatches } from "@/features/catalog/catalog-empty";
import { CatalogNavigation } from "@/features/catalog/catalog-navigation";
import {
  parseCatalogQuery,
  toApiSearchParams,
  type CatalogQuery,
} from "@/features/catalog/catalog-query";
import { FamilyFilter } from "@/features/catalog/family-filter";
import { Pagination } from "@/features/catalog/pagination";
import { paginationModel } from "@/features/catalog/pagination-model";
import { ProductGrid } from "@/features/catalog/product-grid";
import { SortSelect } from "@/features/catalog/sort-select";
import { getProducts } from "@/lib/backend/client";
import type { ProductPage } from "@/lib/backend/schemas";

export const metadata: Metadata = {
  title: "Shop all candles | Wick & Co. Candles",
  description:
    "Hand poured candles in floral, woody, fresh, gourmand and spicy scents.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function Results({
  query,
  result,
}: {
  query: CatalogQuery;
  result: ProductPage;
}) {
  if (result.totalItems === 0) return <NoMatches />;
  if (paginationModel(query.page, result.totalPages).outOfRange) {
    return <EmptyPage query={query} />;
  }
  return (
    <>
      <ProductGrid products={result.items} />
      <Pagination query={query} totalPages={result.totalPages} />
    </>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = parseCatalogQuery(await searchParams);
  const result = await getProducts(toApiSearchParams(query));
  return (
    <StatusRegionProvider action={addToCart}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          All candles
        </h1>
        <StatusRegion />
      </div>
      <div className="mt-4 grid gap-8 md:grid-cols-[13rem_1fr] lg:grid-cols-[14rem_1fr]">
        <div className="flex flex-col gap-8">
          <CatalogNavigation query={query}>
            <FamilyFilter />
            <SortSelect />
          </CatalogNavigation>
        </div>
        <div className="flex flex-col gap-8">
          <Results query={query} result={result} />
        </div>
      </div>
    </StatusRegionProvider>
  );
}
