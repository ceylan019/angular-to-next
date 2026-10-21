const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatUsd(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(
      `Cents must be a safe integer, received ${String(cents)}`,
    );
  }
  return usd.format(cents / 100);
}

export function formatShipping(cents: number): string {
  return cents === 0 ? "Free" : formatUsd(cents);
}
