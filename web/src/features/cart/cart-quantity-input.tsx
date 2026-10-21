"use client";

import { startTransition, useId, useState } from "react";
import { useCartQuantityAction } from "@/components/status-region";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/components/use-hydrated";

export function CartQuantityInput({
  productId,
  name,
  quantity,
  cap,
}: {
  productId: number;
  name: string;
  quantity: number;
  cap: number;
}) {
  const inputId = useId();
  const hydrated = useHydrated();
  const commit = useCartQuantityAction();
  const [draft, setDraft] = useState<string | null>(null);
  const commitOnChange = (input: HTMLInputElement) => {
    const send = () => {
      startTransition(() => {
        setDraft(null);
        commit({ productId, quantity: input.value });
      });
    };
    input.addEventListener("change", send);
    return () => {
      input.removeEventListener("change", send);
    };
  };
  return (
    <>
      <label htmlFor={inputId} className="sr-only">
        {`Quantity for ${name}`}
      </label>
      <Input
        ref={commitOnChange}
        id={inputId}
        type="number"
        inputMode="numeric"
        min={1}
        max={cap}
        value={draft ?? String(quantity)}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        disabled={!hydrated}
        className="h-9 w-20 bg-surface text-ink"
      />
    </>
  );
}
