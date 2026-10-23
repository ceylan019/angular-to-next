"use client";

import { useId } from "react";
import {
  useCartActionState,
  useCartFormAction,
} from "@/components/status-region";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QuantityAddForm({ slug, cap }: { slug: string; cap: number }) {
  const formAction = useCartFormAction();
  const state = useCartActionState();
  const quantityId = useId();
  const typed = state.status === "idle" ? null : state.submittedQuantity;
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
          defaultValue={typed ?? "1"}
          disabled={soldOut}
          className="h-9 w-24 bg-surface text-ink"
        />
      </div>
      <Button
        type="submit"
        disabled={soldOut}
        focus="outline"
        className="h-9 px-6"
      >
        Add to cart
      </Button>
    </form>
  );
}
