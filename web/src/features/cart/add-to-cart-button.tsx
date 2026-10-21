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
        className="h-9 w-full focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
      >
        Add to cart
      </Button>
    </form>
  );
}
