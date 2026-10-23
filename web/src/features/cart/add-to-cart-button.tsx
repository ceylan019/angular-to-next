"use client";

import { useCartFormAction } from "@/components/status-region";
import { Button } from "@/components/ui/button";

export function AddToCartButton({
  slug,
  disabled,
  describedBy,
}: {
  slug: string;
  disabled: boolean;
  describedBy: string;
}) {
  const formAction = useCartFormAction();
  return (
    <form action={formAction}>
      <input type="hidden" name="slug" value={slug} />
      <Button
        type="submit"
        disabled={disabled}
        aria-describedby={describedBy}
        focus="outline"
        className="h-9 w-full"
      >
        Add to cart
      </Button>
    </form>
  );
}
