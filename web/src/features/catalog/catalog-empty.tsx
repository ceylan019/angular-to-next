import { EmptyState } from "@/components/empty-state";
import { catalogHref, type CatalogQuery } from "./catalog-query";

export function NoMatches() {
  return (
    <EmptyState
      message="No candles match these filters"
      href="/"
      action="Clear filters"
    />
  );
}

export function EmptyPage({ query }: { query: CatalogQuery }) {
  return (
    <EmptyState
      message="This page is empty."
      href={catalogHref({ ...query, page: 1 })}
      action="Go to page 1"
    />
  );
}
