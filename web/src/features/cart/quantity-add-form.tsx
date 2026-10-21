"use client";

import { useId } from "react";
import { useCartFormAction } from "@/components/status-region";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QuantityAddForm({ slug, cap }: { slug: string; cap: number }) {
  const formAction = useCartFormAction();
  const quantityId = useId();
  const soldOut = cap === 0;
  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2">
        <label htmlFor={quantityId} className="text-sm font-semibold text-ink">
          Quantity
        </label>
        <Input
          id={quantityId}
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={cap}
          defaultValue={1}
          disabled={soldOut}
          className="h-9 w-24 bg-surface text-ink"
        />
      </div>
      <Button
        type="submit"
        disabled={soldOut}
        className="h-9 px-6 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
      >
        Add to cart
      </Button>
    </form>
  );
}
