import { describe, expect, it } from "vitest";
import { placeOrderInputSchema } from "@/lib/backend/schemas";
import type { CartLine } from "@/features/cart/cart-cookie";
import {
  buildCheckoutSchema,
  toPlaceOrderInput,
  type CheckoutValues,
} from "./checkout-schema";

const now = new Date("2026-10-21T12:00:00Z");
const schema = buildCheckoutSchema(now);

const valid: CheckoutValues = {
  email: "ada@example.com",
  fullName: "Ada Lovelace",
  line1: "1 Main Street",
  line2: "Flat 2",
  city: "London",
  postalCode: "SW1A 1AA",
  country: "GB",
  cardNumber: "4242 4242 4242 4242",
  expiry: "12/40",
  cvc: "123",
};

function errorsFor(overrides: Partial<CheckoutValues>) {
  const result = schema.safeParse({ ...valid, ...overrides });
  if (result.success) return null;
  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0]);
    byField[key] = [...(byField[key] ?? []), issue.message];
  }
  return byField;
}

const CONTRACT_FIELD_CASES: [keyof CheckoutValues, string, string, string][] = [
  ["email", "empty", "", "Enter your email address"],
  ["email", "whitespace only", "   ", "Enter your email address"],
  ["email", "no at sign", "ada.example.com", "Enter a valid email address"],
  ["email", "no domain dot", "ada@example", "Enter a valid email address"],
  ["email", "no local part", "@example.com", "Enter a valid email address"],
  ["email", "no domain", "ada@.com", "Enter a valid email address"],
  ["email", "empty tld", "ada@example.", "Enter a valid email address"],
  ["email", "inner space", "a da@example.com", "Enter a valid email address"],
  ["email", "two at signs", "a@b@example.com", "Enter a valid email address"],
  [
    "email",
    "255 characters",
    `${"a".repeat(255 - "@example.com".length)}@example.com`,
    "Enter a valid email address",
  ],
  ["fullName", "empty", "", "Enter your full name"],
  ["fullName", "whitespace only", "   ", "Enter your full name"],
  [
    "fullName",
    "101 characters",
    "a".repeat(101),
    "Use 100 characters or fewer",
  ],
  ["line1", "empty", "", "Enter your address"],
  ["line1", "whitespace only", "  \t ", "Enter your address"],
  ["line1", "201 characters", "a".repeat(201), "Use 200 characters or fewer"],
  ["line2", "201 characters", "a".repeat(201), "Use 200 characters or fewer"],
  ["city", "empty", "", "Enter your city"],
  ["city", "whitespace only", "   ", "Enter your city"],
  ["city", "101 characters", "a".repeat(101), "Use 100 characters or fewer"],
  ["postalCode", "empty", "", "Enter your postal code"],
  ["postalCode", "whitespace only", "   ", "Enter your postal code"],
  ["postalCode", "2 characters", "AB", "Enter a valid postal code"],
  ["postalCode", "11 characters", "ABCDEFGHIJK", "Enter a valid postal code"],
  ["postalCode", "punctuation", "SW1A-1AA", "Enter a valid postal code"],
  ["postalCode", "non ASCII letters", "Åäö 123", "Enter a valid postal code"],
  ["country", "empty", "", "Select your country"],
  ["country", "whitespace only", "  ", "Select your country"],
  ["country", "unknown code", "FR", "Select your country"],
  ["country", "lower case code", "gb", "Select your country"],
  ["cardNumber", "empty", "", "Enter your card number"],
  ["cardNumber", "whitespace only", "    ", "Enter your card number"],
  ["cardNumber", "15 digits", "424242424242424", "Enter a valid card number"],
  ["cardNumber", "17 digits", "42424242424242426", "Enter a valid card number"],
  [
    "cardNumber",
    "fails Luhn",
    "4242 4242 4242 4241",
    "Enter a valid card number",
  ],
  ["cardNumber", "letters", "4242 4242 4242 42a2", "Enter a valid card number"],
  ["cardNumber", "dashes", "4242-4242-4242-4242", "Enter a valid card number"],
  ["expiry", "empty", "", "Enter the card expiry date"],
  ["expiry", "whitespace only", "   ", "Enter the card expiry date"],
  ["expiry", "single digit month", "1/40", "Enter the expiry as MM/YY"],
  ["expiry", "month 13", "13/40", "Enter the expiry as MM/YY"],
  ["expiry", "month 00", "00/40", "Enter the expiry as MM/YY"],
  ["expiry", "four digit year", "12/2040", "Enter the expiry as MM/YY"],
  ["expiry", "wrong separator", "12-40", "Enter the expiry as MM/YY"],
  ["expiry", "last month", "09/26", "Your card has expired"],
  ["expiry", "last year", "12/25", "Your card has expired"],
  ["expiry", "year 2000", "01/00", "Your card has expired"],
  ["cvc", "empty", "", "Enter the CVC"],
  ["cvc", "whitespace only", "   ", "Enter the CVC"],
  ["cvc", "2 digits", "12", "Enter a valid 3 digit CVC"],
  ["cvc", "4 digits", "1234", "Enter a valid 3 digit CVC"],
  ["cvc", "letters", "12a", "Enter a valid 3 digit CVC"],
  ["cvc", "inner space", "1 2", "Enter a valid 3 digit CVC"],
];

describe("checkout schema", () => {
  it.each(CONTRACT_FIELD_CASES)(
    "[BR-K2] %s with %s shows %s",
    (field, _label, value, message) => {
      expect(errorsFor({ [field]: value })).toEqual({ [field]: [message] });
    },
  );

  it("[BR-K2] accepts a valid form and keeps trimmed values", () => {
    const result = schema.safeParse({
      ...valid,
      email: "  ada@example.com ",
      fullName: " Ada Lovelace  ",
      line1: "  1 Main Street ",
      line2: "  Flat 2 ",
      city: " London ",
      postalCode: " SW1A 1AA ",
      country: " GB ",
      expiry: " 12/40 ",
      cvc: " 123 ",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      ...valid,
      cardNumber: "4242 4242 4242 4242",
    });
  });

  it("[BR-K2] accepts non ASCII names and addresses", () => {
    const result = schema.safeParse({
      ...valid,
      fullName: "Zoë Ångström",
      line1: "Åkerbärsvägen 5",
      city: "Malmö",
    });
    expect(result.success).toBe(true);
    expect(result.data?.fullName).toBe("Zoë Ångström");
  });

  it("[BR-K2] accepts an empty and a blank second address line", () => {
    expect(schema.safeParse({ ...valid, line2: "" }).success).toBe(true);
    expect(schema.safeParse({ ...valid, line2: "   " }).success).toBe(true);
  });

  it.each([
    ["email", "a".repeat(254 - "@example.com".length) + "@example.com"],
    ["fullName", "a".repeat(100)],
    ["line1", "a".repeat(200)],
    ["line2", "a".repeat(200)],
    ["city", "a".repeat(100)],
    ["postalCode", "ABC"],
    ["postalCode", "ABCDEFGHIJ"],
    ["postalCode", "12 345 678"],
    ["cardNumber", "5555555555554444"],
    ["cardNumber", "4000 0000 0000 0002"],
    ["expiry", "10/26"],
    ["expiry", "12/99"],
    ["cvc", "000"],
    ["country", "US"],
    ["country", "CA"],
    ["country", "DE"],
    ["country", "NL"],
  ] as [keyof CheckoutValues, string][])(
    "[BR-K2] accepts %s at the boundary %s",
    (field, value) => {
      expect(errorsFor({ [field]: value })).toBeNull();
    },
  );

  it("[BR-K2] trims before measuring length", () => {
    expect(errorsFor({ fullName: ` ${"a".repeat(100)} ` })).toBeNull();
    expect(errorsFor({ line1: ` ${"a".repeat(200)} ` })).toBeNull();
    expect(errorsFor({ line2: ` ${"a".repeat(200)} ` })).toBeNull();
    expect(errorsFor({ city: ` ${"a".repeat(100)} ` })).toBeNull();
  });

  it("[BR-K2] shows only the first failing message per field", () => {
    expect(errorsFor({ email: `${"a ".repeat(200)}@x` })).toEqual({
      email: ["Enter a valid email address"],
    });
    expect(errorsFor({ expiry: "13/20" })).toEqual({
      expiry: ["Enter the expiry as MM/YY"],
    });
    expect(errorsFor({ fullName: "" })).toEqual({
      fullName: ["Enter your full name"],
    });
    expect(errorsFor({ postalCode: "!".repeat(30) })).toEqual({
      postalCode: ["Enter a valid postal code"],
    });
  });

  it("[BR-K2] reports every invalid field once", () => {
    const result = schema.safeParse({
      email: "",
      fullName: "",
      line1: "",
      line2: "a".repeat(201),
      city: "",
      postalCode: "",
      country: "",
      cardNumber: "",
      expiry: "",
      cvc: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => [i.path[0], i.message])).toEqual([
      ["email", "Enter your email address"],
      ["fullName", "Enter your full name"],
      ["line1", "Enter your address"],
      ["line2", "Use 200 characters or fewer"],
      ["city", "Enter your city"],
      ["postalCode", "Enter your postal code"],
      ["country", "Select your country"],
      ["cardNumber", "Enter your card number"],
      ["expiry", "Enter the card expiry date"],
      ["cvc", "Enter the CVC"],
    ]);
  });

  it("[BR-K2] rejects non string input with the required message", () => {
    const result = schema.safeParse({
      ...valid,
      email: undefined,
      cvc: 123,
      country: null,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => [i.path[0], i.message])).toEqual([
      ["email", "Enter your email address"],
      ["country", "Select your country"],
      ["cvc", "Enter the CVC"],
    ]);
  });

  it("[BR-K3] applies the expiry boundary to the given clock", () => {
    const lastMoment = buildCheckoutSchema(
      new Date("2026-10-31T23:59:59.999Z"),
    );
    const firstAfter = buildCheckoutSchema(
      new Date("2026-11-01T00:00:00.000Z"),
    );
    const input = { ...valid, expiry: "10/26" };
    expect(lastMoment.safeParse(input).success).toBe(true);
    const expired = firstAfter.safeParse(input);
    expect(expired.success).toBe(false);
    expect(expired.error?.issues.map((i) => i.message)).toEqual([
      "Your card has expired",
    ]);
  });
});

describe("toPlaceOrderInput", () => {
  const lines: CartLine[] = [
    { productId: 3, slug: "cedar-hush", quantity: 2, unitPriceCents: 1800 },
    { productId: 9, slug: "lavender-dusk", quantity: 1, unitPriceCents: 1615 },
  ];

  it("[BR-K2] maps form values to the order input", () => {
    const input = toPlaceOrderInput(
      {
        email: " ada@example.com ",
        fullName: " Ada Lovelace ",
        line1: " 1 Main Street ",
        line2: " Flat 2 ",
        city: " London ",
        postalCode: " SW1A 1AA ",
        country: "GB",
        cardNumber: " 4242 4242 4242 4242 ",
        expiry: " 12/40 ",
        cvc: " 123 ",
      },
      lines,
    );
    expect(input).toEqual({
      contact: { email: "ada@example.com" },
      shipping: {
        fullName: "Ada Lovelace",
        line1: "1 Main Street",
        line2: "Flat 2",
        city: "London",
        postalCode: "SW1A 1AA",
        country: "GB",
      },
      payment: {
        cardNumber: "4242424242424242",
        expiry: "12/40",
        cvc: "123",
      },
      lines: [
        { productId: 3, quantity: 2, unitPriceCents: 1800 },
        { productId: 9, quantity: 1, unitPriceCents: 1615 },
      ],
    });
    expect(placeOrderInputSchema.safeParse(input).success).toBe(true);
  });

  it.each(["", "   ", "\t"])("[BR-K2] omits line2 when it is %j", (line2) => {
    const input = toPlaceOrderInput({ ...valid, line2 }, lines);
    expect(input.shipping).not.toHaveProperty("line2");
    expect(placeOrderInputSchema.safeParse(input).success).toBe(true);
  });

  it("[BR-K2] sends no extra keys on a cart line", () => {
    const input = toPlaceOrderInput(valid, lines);
    expect(Object.keys(input.lines[0] ?? {}).sort()).toEqual([
      "productId",
      "quantity",
      "unitPriceCents",
    ]);
  });

  it("[BR-K2] keeps non ASCII text intact", () => {
    const input = toPlaceOrderInput({ ...valid, fullName: "Zoë Ångström" }, []);
    expect(input.shipping.fullName).toBe("Zoë Ångström");
    expect(input.lines).toEqual([]);
  });
});
