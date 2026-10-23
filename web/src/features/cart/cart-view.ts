import { getProduct } from "@/lib/backend/client";
import type { ProductDetail } from "@/lib/backend/schemas";
import type { CartLine } from "./cart-cookie";
import { lineCap } from "./cart-rules";

export type CartRow = {
  productId: number;
  slug: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  cap: number;
};

export function buildCartView(
  lines: CartLine[],
  products: ReadonlyMap<string, ProductDetail | null>,
): CartRow[] {
  return lines.flatMap((line) => {
    const product = products.get(line.slug);
    if (product?.id !== line.productId) return [];
    return [
      {
        productId: line.productId,
        slug: line.slug,
        name: product.name,
        unitPriceCents: line.unitPriceCents,
        quantity: line.quantity,
        lineTotalCents: line.unitPriceCents * line.quantity,
        cap: lineCap(product.stock),
      },
    ];
  });
}

export async function fetchCartProducts(
  lines: CartLine[],
): Promise<Map<string, ProductDetail | null>> {
  const slugs = [...new Set(lines.map((line) => line.slug))];
  return new Map(
    await Promise.all(
      slugs.map(async (slug) => [slug, await getProduct(slug)] as const),
    ),
  );
}
