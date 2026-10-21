import Link from "next/link";
import { Button } from "@/components/ui/button";
import { catalogHref, type CatalogQuery } from "./catalog-query";

function EmptyState({
  message,
  href,
  action,
}: {
  message: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-surface px-6 py-16 text-center shadow-sm ring-1 ring-border">
      <p className="text-lg text-ink">{message}</p>
      <Button asChild focus="outline" className="h-9 px-4">
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}

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
