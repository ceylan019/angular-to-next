import { z } from "zod";
import { productSummarySchema } from "@/lib/backend/schemas";

export const CART_COOKIE = "cart";

export const MAX_PER_LINE = 10;

const cartLineSchema = z.object({
  productId: z.number().int().positive(),
  slug: productSummarySchema.shape.slug,
  quantity: z.number().int().min(1).max(MAX_PER_LINE),
  unitPriceCents: z.number().int().positive(),
});

export type CartLine = z.infer<typeof cartLineSchema>;

function parseRawLines(value: string): unknown[] {
  try {
    const raw: unknown = JSON.parse(value);
    return Array.isArray(raw) ? (raw as unknown[]) : [];
  } catch {
    return [];
  }
}

export function parseCartCookie(value: string | undefined): CartLine[] {
  if (value === undefined) return [];
  const seen = new Set<number>();
  const lines: CartLine[] = [];
  for (const candidate of parseRawLines(value)) {
    const parsed = cartLineSchema.safeParse(candidate);
    if (!parsed.success || seen.has(parsed.data.productId)) continue;
    seen.add(parsed.data.productId);
    lines.push(parsed.data);
  }
  return lines;
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify(
    lines.map(({ productId, slug, quantity, unitPriceCents }) => ({
      productId,
      slug,
      quantity,
      unitPriceCents,
    })),
  );
}
