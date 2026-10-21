import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { orderLines, orders, products } from "../db/schema.js";
import { chargeCard } from "./payment.js";
import { placeOrderSchema, validationFieldPaths } from "./order.schema.js";
import { computeTotals } from "./pricing.js";

export type Order = {
  orderNumber: string;
  email: string;
  shipping: {
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    postalCode: string;
    country: string;
  };
  lines: {
    productId: number;
    name: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  createdAt: string;
};

export type PlaceOrderOutcome =
  | { kind: "placed"; order: Order }
  | { kind: "invalid"; fields: string[] }
  | { kind: "declined" }
  | { kind: "out-of-stock"; items: { productId: number; available: number }[] }
  | {
      kind: "price-changed";
      items: { productId: number; unitPriceCents: number }[];
    };

export type PlaceOrderDeps = {
  now: Date;
  generateOrderNumber: () => string;
};

const MAX_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "23505";
const ORDER_NUMBER_CONSTRAINT = "orders_order_number_unique";

function isOrderNumberCollision(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    const { code, constraint, cause } = current as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };
    if (code === UNIQUE_VIOLATION && constraint === ORDER_NUMBER_CONSTRAINT) {
      return true;
    }
    current = cause;
  }
  return false;
}

type OrderRow = typeof orders.$inferSelect;
type LineRow = typeof orderLines.$inferSelect;

function toOrder(row: OrderRow, lines: LineRow[]): Order {
  return {
    orderNumber: row.orderNumber,
    email: row.email,
    shipping: {
      fullName: row.fullName,
      line1: row.line1,
      line2: row.line2,
      city: row.city,
      postalCode: row.postalCode,
      country: row.country,
    },
    lines: lines.map((l) => ({
      productId: l.productId,
      name: l.productName,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      lineTotalCents: l.lineTotalCents,
    })),
    subtotalCents: row.subtotalCents,
    shippingCents: row.shippingCents,
    totalCents: row.totalCents,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getOrder(
  db: Db,
  orderNumber: string,
): Promise<Order | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber));
  if (!row) return null;
  const lines = await db
    .select()
    .from(orderLines)
    .where(eq(orderLines.orderId, row.id))
    .orderBy(asc(orderLines.id));
  return toOrder(row, lines);
}

export async function placeOrder(
  db: Db,
  body: unknown,
  deps: PlaceOrderDeps,
): Promise<PlaceOrderOutcome> {
  const parsed = placeOrderSchema(deps.now).safeParse(body);
  if (!parsed.success) {
    return { kind: "invalid", fields: validationFieldPaths(parsed.error) };
  }
  const input = parsed.data;
  if (chargeCard(input.payment.cardNumber) === "declined") {
    return { kind: "declined" };
  }

  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptPlace(db, input, deps.generateOrderNumber());
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isOrderNumberCollision(error)) {
        throw error;
      }
    }
  }
}

async function attemptPlace(
  db: Db,
  input: ReturnType<ReturnType<typeof placeOrderSchema>["parse"]>,
  orderNumber: string,
): Promise<PlaceOrderOutcome> {
  return db.transaction(async (tx) => {
    const ids = input.lines.map((l) => l.productId);
    const locked = await tx
      .select()
      .from(products)
      .where(inArray(products.id, ids))
      .orderBy(asc(products.id))
      .for("update");
    const byId = new Map(locked.map((p) => [p.id, p]));

    const short = input.lines.flatMap((l) => {
      const available = byId.get(l.productId)?.stock ?? 0;
      return l.quantity > available
        ? [{ productId: l.productId, available }]
        : [];
    });
    if (short.length > 0) return { kind: "out-of-stock", items: short };

    const changed = input.lines.flatMap((l) => {
      const current = byId.get(l.productId);
      return current && current.priceCents !== l.unitPriceCents
        ? [{ productId: l.productId, unitPriceCents: current.priceCents }]
        : [];
    });
    if (changed.length > 0) return { kind: "price-changed", items: changed };

    for (const l of input.lines) {
      const current = byId.get(l.productId);
      if (!current) continue;
      await tx
        .update(products)
        .set({ stock: current.stock - l.quantity })
        .where(eq(products.id, l.productId));
    }

    const totals = computeTotals(input.lines);
    const [row] = await tx
      .insert(orders)
      .values({
        orderNumber,
        email: input.contact.email,
        fullName: input.shipping.fullName,
        line1: input.shipping.line1,
        line2: input.shipping.line2 ?? null,
        city: input.shipping.city,
        postalCode: input.shipping.postalCode,
        country: input.shipping.country,
        ...totals,
      })
      .returning();
    if (!row) throw new Error("order insert returned no row");

    const lineRows = await tx
      .insert(orderLines)
      .values(
        input.lines.map((l) => ({
          orderId: row.id,
          productId: l.productId,
          productName: byId.get(l.productId)?.name ?? "",
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          lineTotalCents: l.unitPriceCents * l.quantity,
        })),
      )
      .returning();
    lineRows.sort((a, b) => a.id - b.id);
    return { kind: "placed", order: toOrder(row, lineRows) };
  });
}
