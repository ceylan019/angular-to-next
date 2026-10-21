import { z } from "zod";
import type { PlaceOrderInput } from "@/lib/backend/schemas";
import type { CartLine } from "@/features/cart/cart-cookie";
import {
  isExpired,
  isLuhnValid,
  normalizeCardNumber,
  parseExpiry,
} from "./card";
import { COUNTRIES } from "./countries";

export type CheckoutValues = {
  email: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
};

type Rule = readonly [(value: string) => boolean, string];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE = /^[A-Za-z0-9 ]{3,10}$/;
const CVC = /^\d{3}$/;
const CARD_DIGITS = /^\d{16}$/;

const maxLength = (max: number, message: string): Rule => [
  (value) => value.length <= max,
  message,
];

const matches = (pattern: RegExp, message: string): Rule => [
  (value) => pattern.test(value),
  message,
];

const field = (required: string, ...rules: Rule[]) =>
  z
    .string(required)
    .trim()
    .superRefine((value, ctx) => {
      if (value.length === 0) {
        ctx.addIssue({ code: "custom", message: required });
        return;
      }
      for (const [passes, message] of rules) {
        if (!passes(value)) {
          ctx.addIssue({ code: "custom", message });
          return;
        }
      }
    });

const isCardNumber = (value: string) => {
  const digits = normalizeCardNumber(value);
  return CARD_DIGITS.test(digits) && isLuhnValid(digits);
};

const isCurrent = (now: Date) => (value: string) => {
  const parsed = parseExpiry(value);
  return parsed !== null && !isExpired(parsed, now);
};

export function buildCheckoutSchema(now: Date): z.ZodType<CheckoutValues> {
  return z.object({
    email: field(
      "Enter your email address",
      maxLength(254, "Enter a valid email address"),
      matches(EMAIL, "Enter a valid email address"),
    ),
    fullName: field(
      "Enter your full name",
      maxLength(100, "Use 100 characters or fewer"),
    ),
    line1: field(
      "Enter your address",
      maxLength(200, "Use 200 characters or fewer"),
    ),
    line2: z.string().trim().max(200, "Use 200 characters or fewer"),
    city: field(
      "Enter your city",
      maxLength(100, "Use 100 characters or fewer"),
    ),
    postalCode: field(
      "Enter your postal code",
      matches(POSTAL_CODE, "Enter a valid postal code"),
    ),
    country: field("Select your country", [
      (value) => COUNTRIES.some((country) => country.code === value),
      "Select your country",
    ]),
    cardNumber: field("Enter your card number", [
      isCardNumber,
      "Enter a valid card number",
    ]),
    expiry: field(
      "Enter the card expiry date",
      [(value) => parseExpiry(value) !== null, "Enter the expiry as MM/YY"],
      [isCurrent(now), "Your card has expired"],
    ),
    cvc: field("Enter the CVC", matches(CVC, "Enter a valid 3 digit CVC")),
  });
}

export function toPlaceOrderInput(
  values: CheckoutValues,
  lines: CartLine[],
): PlaceOrderInput {
  const line2 = values.line2.trim();
  return {
    contact: { email: values.email.trim() },
    shipping: {
      fullName: values.fullName.trim(),
      line1: values.line1.trim(),
      ...(line2 === "" ? {} : { line2 }),
      city: values.city.trim(),
      postalCode: values.postalCode.trim(),
      country: values.country.trim() as PlaceOrderInput["shipping"]["country"],
    },
    payment: {
      cardNumber: normalizeCardNumber(values.cardNumber.trim()),
      expiry: values.expiry.trim(),
      cvc: values.cvc.trim(),
    },
    lines: lines.map(({ productId, quantity, unitPriceCents }) => ({
      productId,
      quantity,
      unitPriceCents,
    })),
  };
}
