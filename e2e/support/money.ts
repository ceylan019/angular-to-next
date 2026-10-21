const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function usd(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`usd expects whole cents, got ${String(cents)}`);
  }
  return formatter.format(cents / 100);
}
