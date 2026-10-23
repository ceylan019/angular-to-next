import { z } from "zod";
import raw from "./catalog.json" with { type: "json" };

export const FAMILY_SLUGS = [
  "floral",
  "woody",
  "fresh",
  "gourmand",
  "spicy",
  "herbal",
] as const;

export type FamilySlug = (typeof FAMILY_SLUGS)[number];

export const FAMILIES: readonly {
  slug: FamilySlug;
  name: string;
  position: number;
}[] = [
  { slug: "floral", name: "Floral", position: 1 },
  { slug: "woody", name: "Woody", position: 2 },
  { slug: "fresh", name: "Fresh", position: 3 },
  { slug: "gourmand", name: "Gourmand", position: 4 },
  { slug: "spicy", name: "Spicy", position: 5 },
  { slug: "herbal", name: "Herbal", position: 6 },
];

const catalogEntry = z.strictObject({
  slug: z.string().min(1),
  name: z.string().min(1),
  family: z.enum(FAMILY_SLUGS),
  priceCents: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
  summary: z.string().min(1),
  description: z.string().min(1),
  scentNotes: z.array(z.string().min(1)),
  burnTimeHours: z.number().int().positive(),
  sizeOz: z.number().int().positive(),
});

export type CatalogEntry = z.infer<typeof catalogEntry>;

export const CATALOG: readonly CatalogEntry[] = z
  .array(catalogEntry)
  .parse(raw);
