import { MAX_PER_LINE, type CartLine } from "./cart-cookie";

export { MAX_PER_LINE };

type Outcome<Kind extends string> = {
  lines: CartLine[];
  outcome: Kind | "clamped";
  cap: number;
};

export function lineCap(stock: number): number {
  return Math.max(0, Math.min(MAX_PER_LINE, stock));
}

export function normalizeRequestedQuantity(input: unknown): number {
  const value = typeof input === "string" ? Number(input) : input;
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : 1;
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function removeLine(lines: CartLine[], productId: number): CartLine[] {
  return lines.filter((line) => line.productId !== productId);
}

export function addLine(
  lines: CartLine[],
  product: { id: number; slug: string; priceCents: number; stock: number },
  requested: number,
): Outcome<"added"> {
  const cap = lineCap(product.stock);
  if (cap === 0) {
    return { lines: removeLine(lines, product.id), outcome: "clamped", cap };
  }
  const existing = lines.find((line) => line.productId === product.id);
  const wanted =
    (existing?.quantity ?? 0) + normalizeRequestedQuantity(requested);
  const next: CartLine = {
    productId: product.id,
    slug: product.slug,
    quantity: Math.min(wanted, cap),
    unitPriceCents: product.priceCents,
  };
  return {
    lines: existing
      ? lines.map((line) => (line === existing ? next : line))
      : [...lines, next],
    outcome: wanted > cap ? "clamped" : "added",
    cap,
  };
}

export function setLineQuantity(
  lines: CartLine[],
  productId: number,
  requested: number,
  stock: number,
): Outcome<"updated"> {
  const cap = lineCap(stock);
  if (!lines.some((line) => line.productId === productId)) {
    return { lines, outcome: "updated", cap };
  }
  if (cap === 0) {
    return { lines: removeLine(lines, productId), outcome: "clamped", cap };
  }
  const wanted = normalizeRequestedQuantity(requested);
  return {
    lines: lines.map((line) =>
      line.productId === productId
        ? { ...line, quantity: Math.min(wanted, cap) }
        : line,
    ),
    outcome: wanted > cap ? "clamped" : "updated",
    cap,
  };
}

export function applyStockLimits(
  lines: CartLine[],
  items: { productId: number; available: number }[],
): CartLine[] {
  return lines.flatMap((line) => {
    const item = items.find((entry) => entry.productId === line.productId);
    if (!item) return [line];
    const cap = lineCap(item.available);
    if (cap === 0) return [];
    return [{ ...line, quantity: Math.min(line.quantity, cap) }];
  });
}

export function applyPriceChanges(
  lines: CartLine[],
  items: { productId: number; unitPriceCents: number }[],
): CartLine[] {
  return lines.map((line) => {
    const item = items.find((entry) => entry.productId === line.productId);
    return item ? { ...line, unitPriceCents: item.unitPriceCents } : line;
  });
}
