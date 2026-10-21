import { z } from "zod";
import {
  isExpired,
  isLuhnValid,
  normalizeCardNumber,
  parseExpiry,
} from "./payment.js";
import { MAX_QUANTITY_PER_LINE } from "./pricing.js";

export const COUNTRIES = ["US", "CA", "GB", "DE", "NL"] as const;

export type PlaceOrderBody = {
  contact: { email: string };
  shipping: {
    fullName: string;
    line1: string;
    line2?: string | undefined;
    city: string;
    postalCode: string;
    country: (typeof COUNTRIES)[number];
  };
  payment: { cardNumber: string; expiry: string; cvc: string };
  lines: { productId: number; quantity: number; unitPriceCents: number }[];
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE = /^[A-Za-z0-9 ]{3,10}$/;
const CVC = /^\d{3}$/;

type Rule = readonly [(value: string) => boolean, string];

const field = (required: string, ...rules: Rule[]) =>
  z
    .string(required)
    .trim()
    .superRefine((value, ctx) => {
      if (value.length === 0) {
        ctx.addIssue(required);
        return;
      }
      for (const [passes, message] of rules) {
        if (!passes(value)) {
          ctx.addIssue(message);
          return;
        }
      }
    });

const maxLength = (max: number, message: string): Rule => [
  (value) => value.length <= max,
  message,
];

const matches = (pattern: RegExp, message: string): Rule => [
  (value) => pattern.test(value),
  message,
];

const email = field(
  "Enter your email address",
  matches(EMAIL, "Enter a valid email address"),
  maxLength(254, "Enter a valid email address"),
);

const optionalLine = z
  .string("Use 200 characters or fewer")
  .trim()
  .max(200, "Use 200 characters or fewer")
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const cardNumber = field("Enter your card number", [
  (value) => {
    const digits = normalizeCardNumber(value);
    return /^\d{16}$/.test(digits) && isLuhnValid(digits);
  },
  "Enter a valid card number",
]).transform(normalizeCardNumber);

const cvc = field("Enter the CVC", matches(CVC, "Enter a valid 3 digit CVC"));

const expiry = (now: Date) =>
  field(
    "Enter the card expiry date",
    [(value) => parseExpiry(value) !== null, "Enter the expiry as MM/YY"],
    [
      (value) => {
        const parsed = parseExpiry(value);
        return parsed !== null && !isExpired(parsed, now);
      },
      "Your card has expired",
    ],
  );

const line = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
  unitPriceCents: z.number().int().positive(),
});

const lines = z
  .array(line)
  .min(1)
  .refine(
    (items) =>
      new Set(items.map((item) => item.productId)).size === items.length,
    "Duplicate products",
  );

export function placeOrderSchema(now: Date): z.ZodType<PlaceOrderBody> {
  return z.object({
    contact: z.object({ email }),
    shipping: z.object({
      fullName: field(
        "Enter your full name",
        maxLength(100, "Use 100 characters or fewer"),
      ),
      line1: field(
        "Enter your address",
        maxLength(200, "Use 200 characters or fewer"),
      ),
      line2: optionalLine,
      city: field(
        "Enter your city",
        maxLength(100, "Use 100 characters or fewer"),
      ),
      postalCode: field(
        "Enter your postal code",
        matches(POSTAL_CODE, "Enter a valid postal code"),
      ),
      country: z.enum(COUNTRIES, "Select your country"),
    }),
    payment: z.object({
      cardNumber,
      expiry: expiry(now),
      cvc,
    }),
    lines,
  });
}

export function validationFieldPaths(error: z.ZodError): string[] {
  const paths: string[] = [];
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!paths.includes(path)) paths.push(path);
  }
  return paths;
}
