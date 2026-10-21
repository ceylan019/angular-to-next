import Image from "next/image";
import { StatusRegion } from "@/components/status-region";
import { lineCap } from "@/features/cart/cart-rules";
import { QuantityAddForm } from "@/features/cart/quantity-add-form";
import type { ProductDetail } from "@/lib/backend/schemas";
import { formatUsd } from "@/lib/money";
import { PRODUCT_IMAGE_SIDE } from "./product-card";
import { stockStatus } from "./stock-status";

export const PRODUCT_DETAIL_IMAGE_SIZES =
  "(min-width: 1152px) 536px, (min-width: 768px) 50vw, 100vw";

export function ProductDetails({ product }: { product: ProductDetail }) {
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12">
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={PRODUCT_IMAGE_SIDE}
        height={PRODUCT_IMAGE_SIDE}
        sizes={PRODUCT_DETAIL_IMAGE_SIZES}
        preload
        className="aspect-square w-full rounded-xl bg-border object-cover shadow-sm ring-1 ring-border"
      />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            {product.name}
          </h1>
          <p className="text-xl font-medium text-ink">
            {formatUsd(product.priceCents)}
          </p>
          <p className="text-sm text-muted-foreground">
            {stockStatus(product.stock)}
          </p>
        </div>
        <p className="leading-relaxed text-ink">{product.description}</p>
        <div className="flex flex-col gap-1 text-sm text-ink">
          <p>{`Scent notes: ${product.scentNotes.join(", ")}`}</p>
          <p>{`Burn time: ${String(product.burnTimeHours)} hours`}</p>
          <p>{`Size: ${String(product.sizeOz)} oz`}</p>
        </div>
        <div className="flex flex-col gap-2">
          <QuantityAddForm slug={product.slug} cap={lineCap(product.stock)} />
          <StatusRegion />
        </div>
      </div>
    </div>
  );
}
