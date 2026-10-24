"use client";

import type { ComponentProps } from "react";
import { useHydrated } from "@/components/use-hydrated";
import { useCatalogNavigation } from "./catalog-navigation";
import { toSortKey, withSort } from "./catalog-query";

export function SortSelectControl(props: ComponentProps<"select">) {
  const hydrated = useHydrated();
  const { query, navigate } = useCatalogNavigation();
  return (
    <select
      {...props}
      value={query.sort}
      disabled={!hydrated}
      onChange={(event) => {
        navigate(withSort(query, toSortKey(event.target.value)));
      }}
    />
  );
}
