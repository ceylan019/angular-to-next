"use client";

import { useHydrated } from "@/components/use-hydrated";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useCatalogNavigation } from "./catalog-navigation";
import { SORT_OPTIONS, toSortKey, withSort } from "./catalog-query";

export function SortSelect() {
  const hydrated = useHydrated();
  const { query, navigate } = useCatalogNavigation();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="sort" className="text-sm font-semibold text-ink">
        Sort by
      </label>
      <NativeSelect
        id="sort"
        value={query.sort}
        disabled={!hydrated}
        onChange={(event) => {
          navigate(withSort(query, toSortKey(event.target.value)));
        }}
        className="w-full [&>select]:h-9 [&>select]:bg-surface"
      >
        {SORT_OPTIONS.map(({ value, label }) => (
          <NativeSelectOption key={value} value={value}>
            {label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
