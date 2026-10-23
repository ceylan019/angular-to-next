import type { ProductSummary } from "@/lib/backend/schemas";
import { ProductCard } from "./product-card";

const FIRST_ROW = 3;

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  return (
    <ul
      aria-label="Products"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          preload={index < FIRST_ROW}
        />
      ))}
    </ul>
  );
}
