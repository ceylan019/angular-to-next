import Link from "next/link";
import { cn } from "@/lib/utils";
import { catalogHref, type CatalogQuery } from "./catalog-query";
import { paginationModel } from "./pagination-model";

const LINK =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium text-ink ring-1 ring-border hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function Pagination({
  query,
  totalPages,
}: {
  query: CatalogQuery;
  totalPages: number;
}) {
  const model = paginationModel(query.page, totalPages);
  if (!model.show) return null;
  const href = (page: number) => catalogHref({ ...query, page });
  return (
    <nav aria-label="Pagination" className="flex justify-center">
      <ul className="flex flex-wrap items-center gap-2">
        {model.previous === null ? null : (
          <li>
            <Link href={href(model.previous)} className={LINK}>
              Previous
            </Link>
          </li>
        )}
        {model.pages.map((page) => {
          const current = page === query.page;
          return (
            <li key={page}>
              <Link
                href={href(page)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  LINK,
                  current &&
                    "bg-primary text-primary-foreground ring-primary hover:bg-[color-mix(in_oklch,var(--primary),black_20%)]",
                )}
              >
                {page}
              </Link>
            </li>
          );
        })}
        {model.next === null ? null : (
          <li>
            <Link href={href(model.next)} className={LINK}>
              Next
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
