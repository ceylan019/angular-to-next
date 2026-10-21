import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TotalsList } from "@/features/cart/totals-list";
import { countryName } from "@/features/checkout/countries";
import type { Order } from "@/lib/backend/schemas";
import { formatUsd } from "@/lib/money";

const PANEL =
  "flex flex-col gap-6 rounded-xl bg-surface p-6 shadow-sm ring-1 ring-border";

export function OrderDetails({ order }: { order: Order }) {
  const { shipping } = order;
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        Thank you for your order
      </h1>
      <p className="text-lg text-muted-foreground">{`Order number: ${order.orderNumber}`}</p>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className={PANEL}>
          <ul aria-label="Items" className="flex flex-col gap-3 border-b pb-6">
            {order.lines.map((line, index) => (
              <li
                key={index}
                className="flex items-baseline justify-between gap-4 text-ink"
              >
                <span className="min-w-0 break-words">{`${line.name} × ${String(line.quantity)}`}</span>
                <span className="font-medium">
                  {formatUsd(line.lineTotalCents)}
                </span>
              </li>
            ))}
          </ul>
          <TotalsList totals={order} />
        </div>
        <div className={PANEL}>
          <h2 className="text-lg font-semibold text-ink">Shipping to</h2>
          <address className="-mt-3 flex flex-col gap-1 text-ink not-italic">
            <span className="break-words">{shipping.fullName}</span>
            <span className="break-words">{shipping.line1}</span>
            {shipping.line2 === null || shipping.line2 === "" ? null : (
              <span className="break-words">{shipping.line2}</span>
            )}
            <span className="break-words">{`${shipping.city} ${shipping.postalCode}`}</span>
            <span className="break-words">{countryName(shipping.country)}</span>
          </address>
          <Button asChild focus="outline" className="h-10 w-full">
            <Link href="/">Continue shopping</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
