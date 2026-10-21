"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useOptimistic,
  useTransition,
  type ReactNode,
} from "react";
import { catalogHref, type CatalogQuery } from "./catalog-query";

type CatalogNavigationValue = {
  query: CatalogQuery;
  navigate: (next: CatalogQuery) => void;
};

const CatalogNavigationContext = createContext<CatalogNavigationValue | null>(
  null,
);

export function CatalogNavigation({
  query,
  children,
}: {
  query: CatalogQuery;
  children: ReactNode;
}) {
  const router = useRouter();
  const [shown, setShown] = useOptimistic(query);
  const [, startTransition] = useTransition();

  function navigate(next: CatalogQuery): void {
    startTransition(() => {
      setShown(next);
      router.push(catalogHref(next));
    });
  }

  return (
    <CatalogNavigationContext value={{ query: shown, navigate }}>
      {children}
    </CatalogNavigationContext>
  );
}

export function useCatalogNavigation(): CatalogNavigationValue {
  const value = use(CatalogNavigationContext);
  if (value === null) {
    throw new Error("Catalog controls need a CatalogNavigation above them");
  }
  return value;
}
