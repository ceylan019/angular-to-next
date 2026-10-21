export const FAMILY_SLUGS = [
  "floral",
  "woody",
  "fresh",
  "gourmand",
  "spicy",
  "herbal",
] as const;

export type FamilySlug = (typeof FAMILY_SLUGS)[number];
