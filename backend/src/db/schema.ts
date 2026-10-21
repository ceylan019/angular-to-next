import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const families = pgTable("families", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull().unique(),
    familySlug: text("family_slug")
      .notNull()
      .references(() => families.slug),
    priceCents: integer("price_cents").notNull(),
    stock: integer("stock").notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull(),
    scentNotes: text("scent_notes").array().notNull(),
    burnTimeHours: integer("burn_time_hours").notNull(),
    sizeOz: integer("size_oz").notNull(),
  },
  (t) => [
    check("products_price_positive", sql`${t.priceCents} > 0`),
    check("products_stock_non_negative", sql`${t.stock} >= 0`),
  ],
);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orderLines = pgTable(
  "order_lines",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (t) => [
    check("order_lines_quantity_range", sql`${t.quantity} between 1 and 10`),
  ],
);
