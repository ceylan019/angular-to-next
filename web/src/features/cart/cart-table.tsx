import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUsd } from "@/lib/money";
import { removeFromCart } from "./cart-actions";
import { CartQuantityInput } from "./cart-quantity-input";
import type { CartRow } from "./cart-view";

export function CartTable({ rows }: { rows: CartRow[] }) {
  return (
    <div className="rounded-xl bg-surface shadow-sm ring-1 ring-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4">Candle</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Total</TableHead>
            <TableHead className="px-4 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.productId}>
              <TableCell className="px-4 py-3">
                <Link
                  href={`/products/${row.slug}`}
                  className="rounded-sm font-medium text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {row.name}
                </Link>
              </TableCell>
              <TableCell className="text-ink">
                {formatUsd(row.unitPriceCents)}
              </TableCell>
              <TableCell>
                <CartQuantityInput
                  productId={row.productId}
                  name={row.name}
                  quantity={row.quantity}
                  cap={row.cap}
                />
              </TableCell>
              <TableCell className="font-medium text-ink">
                {formatUsd(row.lineTotalCents)}
              </TableCell>
              <TableCell className="px-4 text-right">
                <form action={removeFromCart.bind(null, row.productId)}>
                  <Button
                    type="submit"
                    variant="outline"
                    focus="outline"
                    className="h-9 px-3"
                  >
                    Remove <span className="sr-only">{row.name}</span>
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
