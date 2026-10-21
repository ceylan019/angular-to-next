import { TotalsList } from "@/features/cart/totals-list";
import type { CartTotals } from "@/features/cart/totals";
import type { CartRow } from "@/features/cart/cart-view";
import { formatUsd } from "@/lib/money";

export function OrderSummary({
  rows,
  totals,
}: {
  rows: CartRow[];
  totals: CartTotals;
}) {
  return (
    <aside
      aria-label="Order summary"
      className="flex flex-col gap-6 rounded-xl bg-surface p-6 shadow-sm ring-1 ring-border"
    >
      <ul className="flex flex-col gap-3 border-b pb-6">
        {rows.map((row) => (
          <li
            key={row.productId}
            className="flex items-baseline justify-between gap-4 text-ink"
          >
            <span>{`${row.name} × ${String(row.quantity)}`}</span>
            <span className="font-medium">{formatUsd(row.lineTotalCents)}</span>
          </li>
        ))}
      </ul>
      <TotalsList totals={totals} />
    </aside>
  );
}
