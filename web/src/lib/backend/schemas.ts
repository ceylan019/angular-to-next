import { z } from "zod";

export const FAMILY_SLUGS = [
  "floral",
  "woody",
  "fresh",
  "gourmand",
  "spicy",
  "herbal",
] as const;

export const COUNTRY_CODES = ["US", "CA", "GB", "DE", "NL"] as const;

export const PAGE_SIZE = 12;
export const MAX_QUANTITY_PER_LINE = 10;

const text = z.string().min(1);
const cents = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();

export const familySlugSchema = z.enum(FAMILY_SLUGS);

export const familySchema = z.object({
  slug: familySlugSchema,
  name: text,
});

export const productSummarySchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: text,
  family: familySlugSchema,
  priceCents: cents,
  stock: nonNegativeInt,
  imageUrl: z.string().regex(/^\/images\/[a-z0-9-]+\.jpg$/),
});

export const productDetailSchema = productSummarySchema.extend({
  summary: text,
  description: text,
  scentNotes: z.array(text),
  burnTimeHours: z.number().int().positive(),
  sizeOz: z.number().int().positive(),
});

export const productPageSchema = z.object({
  items: z.array(productSummarySchema),
  page: z.number().int().min(1),
  pageSize: z.literal(PAGE_SIZE),
  totalItems: nonNegativeInt,
  totalPages: nonNegativeInt,
});

export const orderSchema = z.object({
  orderNumber: z.string().regex(/^WC-[A-Z0-9]{6}$/),
  email: text,
  shipping: z.object({
    fullName: text,
    line1: text,
    line2: z.string().nullable(),
    city: text,
    postalCode: text,
    country: text,
  }),
  lines: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        name: text,
        quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
        unitPriceCents: cents,
        lineTotalCents: cents,
      }),
    )
    .min(1),
  subtotalCents: cents,
  shippingCents: nonNegativeInt,
  totalCents: cents,
  createdAt: z.iso.datetime(),
});

export const placeOrderInputSchema = z.object({
  contact: z.object({ email: z.string() }),
  shipping: z.object({
    fullName: z.string(),
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    postalCode: z.string(),
    country: z.enum(COUNTRY_CODES),
  }),
  payment: z.object({
    cardNumber: z.string(),
    expiry: z.string(),
    cvc: z.string(),
  }),
  lines: z.array(
    z.object({
      productId: z.number().int(),
      quantity: z.number().int(),
      unitPriceCents: z.number().int(),
    }),
  ),
});

export const validationErrorSchema = z.object({
  error: z.literal("VALIDATION"),
  fields: z.array(z.string()),
});

export const cardDeclinedSchema = z.object({
  error: z.literal("CARD_DECLINED"),
});

export const outOfStockSchema = z.object({
  error: z.literal("OUT_OF_STOCK"),
  items: z.array(
    z.object({
      productId: z.number().int(),
      available: nonNegativeInt,
    }),
  ),
});

export const priceChangedSchema = z.object({
  error: z.literal("PRICE_CHANGED"),
  items: z.array(
    z.object({
      productId: z.number().int(),
      unitPriceCents: cents,
    }),
  ),
});

export type FamilySlug = z.infer<typeof familySlugSchema>;
export type Family = z.infer<typeof familySchema>;
export type ProductSummary = z.infer<typeof productSummarySchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;
export type ProductPage = z.infer<typeof productPageSchema>;
export type Order = z.infer<typeof orderSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderInputSchema>;
