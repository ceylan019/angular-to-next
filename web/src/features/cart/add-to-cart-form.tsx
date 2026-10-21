"use client";

import type { ReactNode } from "react";
import { useCartFormAction } from "@/components/status-region";

export function AddToCartForm({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const formAction = useCartFormAction();
  return (
    <form action={formAction}>
      <input type="hidden" name="slug" value={slug} />
      {children}
    </form>
  );
}
