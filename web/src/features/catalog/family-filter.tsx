"use client";

import { useId } from "react";
import { useHydrated } from "@/components/use-hydrated";
import { useCatalogNavigation } from "./catalog-navigation";
import { FAMILY_OPTIONS, toggleFamily } from "./catalog-query";

export function FamilyFilter() {
  const hydrated = useHydrated();
  const idPrefix = useId();
  const { query, navigate } = useCatalogNavigation();
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-3 text-sm font-semibold text-ink">
        Scent family
      </legend>
      {FAMILY_OPTIONS.map(({ slug, label }) => {
        const id = `${idPrefix}-${slug}`;
        return (
          <div key={slug} className="flex items-center gap-2.5">
            <input
              id={id}
              type="checkbox"
              checked={query.families.includes(slug)}
              disabled={!hydrated}
              onChange={() => {
                navigate(toggleFamily(query, slug));
              }}
              className="peer size-4 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <label
              htmlFor={id}
              className="cursor-pointer text-sm text-ink peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {label}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
