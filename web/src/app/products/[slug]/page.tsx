import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { StatusRegionProvider } from "@/components/status-region";
import { addToCart } from "@/features/cart/cart-actions";
import { ProductDetails } from "@/features/catalog/product-details";
import { getProduct } from "@/lib/backend/client";
import type { ProductDetail } from "@/lib/backend/schemas";

type Props = PageProps<"/products/[slug]">;

const findProduct = cache(getProduct);

async function productFor({ params }: Props): Promise<ProductDetail> {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (product === null) notFound();
  return product;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const product = await productFor(props);
  return {
    title: `${product.name} | Wick & Co. Candles`,
    description: product.summary,
  };
}

export default async function ProductPage(props: Props) {
  const product = await productFor(props);
  return (
    <StatusRegionProvider action={addToCart}>
      <ProductDetails product={product} />
    </StatusRegionProvider>
  );
}
