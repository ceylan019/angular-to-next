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
  pending: boolean;
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
  const [pending, startTransition] = useTransition();

  function navigate(next: CatalogQuery): void {
    startTransition(() => {
      setShown(next);
      router.push(catalogHref(next));
    });
  }

  return (
    <CatalogNavigationContext value={{ query: shown, pending, navigate }}>
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

export function CatalogResults({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { pending } = useCatalogNavigation();
  return (
    <div aria-busy={pending} className={className}>
      {children}
    </div>
  );
}
