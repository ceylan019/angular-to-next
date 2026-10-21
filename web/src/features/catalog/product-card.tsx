import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/features/cart/add-to-cart-button";
import type { ProductSummary } from "@/lib/backend/schemas";
import { formatUsd } from "@/lib/money";
import { stockStatus } from "./stock-status";

export const PRODUCT_IMAGE_SIZES =
  "(min-width: 1024px) 272px, (min-width: 640px) 50vw, 100vw";

const IMAGE_SIDE = 1200;

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-border transition-shadow hover:shadow-md">
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={IMAGE_SIDE}
        height={IMAGE_SIDE}
        sizes={PRODUCT_IMAGE_SIZES}
        className="aspect-square w-full bg-border object-cover"
      />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h2 className="text-base font-semibold text-ink">
          <Link
            href={`/products/${product.slug}`}
            className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {product.name}
          </Link>
        </h2>
        <p className="font-medium text-ink">{formatUsd(product.priceCents)}</p>
        <p className="text-sm text-muted-foreground">
          {stockStatus(product.stock)}
        </p>
        <div className="mt-auto pt-3">
          <AddToCartButton slug={product.slug} disabled={product.stock === 0} />
        </div>
      </div>
    </li>
  );
}
