import { z } from "zod";
import { describe, expect, it } from "vitest";
import { placeOrderSchema, validationFieldPaths } from "./order.schema.js";

const now = new Date("2026-10-21T12:00:00Z");
const schema = placeOrderSchema(now);

const valid = () => ({
  contact: { email: "ada@example.com" },
  shipping: {
    fullName: "Ada Lovelace",
    line1: "1 Main Street",
    line2: "Flat 2",
    city: "London",
    postalCode: "SW1A 1AA",
    country: "GB",
  },
  payment: { cardNumber: "4242 4242 4242 4242", expiry: "12/40", cvc: "123" },
  lines: [{ productId: 1, quantity: 1, unitPriceCents: 1800 }],
});

type Body = ReturnType<typeof valid>;

const mutate = (fn: (b: Body) => void) => {
  const b = valid();
  fn(b);
  return b;
};

const pathsOf = (input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? null : validationFieldPaths(result.error);
};

const messagesOf = (input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? null : result.error.issues.map((i) => i.message);
};

describe("placeOrderSchema", () => {
  it("[BR-K2] accepts a complete body", () => {
    const result = schema.safeParse(valid());
    expect(result.success).toBe(true);
  });

  it("[BR-K2] [BR-K3] trims strings and normalizes the card number", () => {
    const result = schema.safeParse(
      mutate((b) => {
        b.contact.email = "  ada@example.com  ";
        b.shipping.fullName = "  Ada  ";
        b.shipping.line1 = " 1 Main ";
        b.shipping.city = " London ";
        b.shipping.postalCode = " SW1A 1AA ";
        b.payment.expiry = " 12/40 ";
        b.payment.cvc = " 123 ";
      }),
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      contact: { email: "ada@example.com" },
      shipping: {
        fullName: "Ada",
        line1: "1 Main",
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
      lines: [{ productId: 1, quantity: 1, unitPriceCents: 1800 }],
    });
  });

  it("[BR-K2] omits line2 when absent", () => {
    const body = mutate((b) => {
      delete (b.shipping as { line2?: string }).line2;
    });
    const result = schema.safeParse(body);
    expect(result.success).toBe(true);
    expect(result.data?.shipping.line2).toBeUndefined();
  });

  it("[BR-K2] rejects a non object body", () => {
    expect(schema.safeParse(null).success).toBe(false);
    expect(schema.safeParse("x").success).toBe(false);
    expect(pathsOf({})).toEqual(["contact", "shipping", "payment", "lines"]);
  });

  it("[BR-K2] missing email", () => {
    expect(
      pathsOf(
        mutate((b) => ((b.contact as { email?: string }).email = undefined)),
      ),
    ).toEqual(["contact.email"]);
    expect(pathsOf({ ...valid(), contact: {} })).toEqual(["contact.email"]);
  });

  it("[BR-K2] email rules and messages", () => {
    const at = (email: unknown) =>
      mutate((b) => ((b.contact as { email: unknown }).email = email));
    expect(messagesOf(at(""))).toEqual(["Enter your email address"]);
    expect(messagesOf(at("   "))).toEqual(["Enter your email address"]);
    expect(messagesOf(at("a@b"))).toEqual(["Enter a valid email address"]);
    expect(pathsOf(at("a@b"))).toEqual(["contact.email"]);
    expect(pathsOf(at("a b@c.de"))).toEqual(["contact.email"]);
    expect(pathsOf(at("@b.de"))).toEqual(["contact.email"]);
    expect(pathsOf(at("a@.de"))).toEqual(["contact.email"]);
    expect(pathsOf(at("a@b."))).toEqual(["contact.email"]);
    expect(pathsOf(at(42))).toEqual(["contact.email"]);
    expect(pathsOf(at("a@b.c d"))).toEqual(["contact.email"]);
    expect(pathsOf(at("a@b.de"))).toBeNull();
  });

  it("[BR-K2] email length boundary at 254", () => {
    const local = "a".repeat(64);
    const ok = `${local}@${"b".repeat(254 - 64 - 1 - 4)}.com`;
    expect(ok.length).toBe(254);
    expect(pathsOf(mutate((b) => (b.contact.email = ok)))).toBeNull();
    const tooLong = `${ok.slice(0, 64)}b${ok.slice(64)}`;
    expect(tooLong.length).toBe(255);
    expect(pathsOf(mutate((b) => (b.contact.email = tooLong)))).toEqual([
      "contact.email",
    ]);
    expect(messagesOf(mutate((b) => (b.contact.email = tooLong)))).toEqual([
      "Enter a valid email address",
    ]);
  });

  it("[BR-K2] rejects a very long dotted email quickly", () => {
    const hostile = `a@${"x.".repeat(50000)}@`;
    const body = mutate((b) => (b.contact.email = hostile));
    const start = performance.now();
    const messages = messagesOf(body);
    const elapsed = performance.now() - start;
    expect(messages).toEqual(["Enter a valid email address"]);
    expect(elapsed).toBeLessThan(500);
  });

  it("[BR-K2] trims the country", () => {
    const body = mutate((b) => (b.shipping.country = " US "));
    const result = schema.safeParse(body);
    expect(result.success).toBe(true);
    expect(result.data?.shipping.country).toBe("US");
    expect(pathsOf(mutate((b) => (b.shipping.country = "  ")))).toEqual([
      "shipping.country",
    ]);
  });

  it("[BR-K2] full name rules", () => {
    const at = (v: unknown) =>
      mutate((b) => ((b.shipping as { fullName: unknown }).fullName = v));
    expect(messagesOf(at("   "))).toEqual(["Enter your full name"]);
    expect(pathsOf(at("   "))).toEqual(["shipping.fullName"]);
    expect(pathsOf(at(""))).toEqual(["shipping.fullName"]);
    expect(pathsOf(at(undefined))).toEqual(["shipping.fullName"]);
    expect(pathsOf(at(5))).toEqual(["shipping.fullName"]);
    expect(pathsOf(at("a".repeat(100)))).toBeNull();
    expect(pathsOf(at(` ${"a".repeat(100)} `))).toBeNull();
    expect(pathsOf(at("a".repeat(101)))).toEqual(["shipping.fullName"]);
    expect(messagesOf(at("a".repeat(101)))).toEqual([
      "Use 100 characters or fewer",
    ]);
  });

  it("[BR-K2] stores non ASCII names intact", () => {
    const result = schema.safeParse(
      mutate((b) => (b.shipping.fullName = "Zoë Ångström")),
    );
    expect(result.success).toBe(true);
    expect(result.data?.shipping.fullName).toBe("Zoë Ångström");
  });

  it("[BR-K2] address line 1 rules", () => {
    const at = (v: unknown) =>
      mutate((b) => ((b.shipping as { line1: unknown }).line1 = v));
    expect(messagesOf(at(" "))).toEqual(["Enter your address"]);
    expect(pathsOf(at(undefined))).toEqual(["shipping.line1"]);
    expect(pathsOf(at("a".repeat(200)))).toBeNull();
    expect(pathsOf(at("a".repeat(201)))).toEqual(["shipping.line1"]);
    expect(messagesOf(at("a".repeat(201)))).toEqual([
      "Use 200 characters or fewer",
    ]);
  });

  it("[BR-K2] address line 2 rules", () => {
    const at = (v: unknown) =>
      mutate((b) => ((b.shipping as { line2: unknown }).line2 = v));
    const empty = schema.safeParse(at(""));
    expect(empty.success).toBe(true);
    expect(empty.data?.shipping.line2).toBeUndefined();
    const blank = schema.safeParse(at("   "));
    expect(blank.data?.shipping.line2).toBeUndefined();
    expect(pathsOf(at("a".repeat(200)))).toBeNull();
    expect(pathsOf(at("a".repeat(201)))).toEqual(["shipping.line2"]);
    expect(messagesOf(at("a".repeat(201)))).toEqual([
      "Use 200 characters or fewer",
    ]);
    expect(pathsOf(at(5))).toEqual(["shipping.line2"]);
    expect(messagesOf(at(5))).toEqual(["Use 200 characters or fewer"]);
    expect(schema.safeParse(at("  Flat 2 ")).data?.shipping.line2).toBe(
      "Flat 2",
    );
  });

  it("[BR-K2] city rules", () => {
    const at = (v: unknown) =>
      mutate((b) => ((b.shipping as { city: unknown }).city = v));
    expect(messagesOf(at("  "))).toEqual(["Enter your city"]);
    expect(pathsOf(at(undefined))).toEqual(["shipping.city"]);
    expect(pathsOf(at("a".repeat(100)))).toBeNull();
    expect(pathsOf(at("a".repeat(101)))).toEqual(["shipping.city"]);
    expect(messagesOf(at("a".repeat(101)))).toEqual([
      "Use 100 characters or fewer",
    ]);
  });

  it("[BR-K2] postal code rules", () => {
    const at = (v: unknown) =>
      mutate((b) => ((b.shipping as { postalCode: unknown }).postalCode = v));
    expect(messagesOf(at(" "))).toEqual(["Enter your postal code"]);
    expect(pathsOf(at(undefined))).toEqual(["shipping.postalCode"]);
    expect(messagesOf(at("AB"))).toEqual(["Enter a valid postal code"]);
    expect(pathsOf(at("AB"))).toEqual(["shipping.postalCode"]);
    expect(pathsOf(at("A".repeat(11)))).toEqual(["shipping.postalCode"]);
    expect(pathsOf(at("AB-123"))).toEqual(["shipping.postalCode"]);
    expect(pathsOf(at("ÅÄÖ12"))).toEqual(["shipping.postalCode"]);
    expect(pathsOf(at("SW1A 1AA"))).toBeNull();
    expect(pathsOf(at("K1A0B1"))).toBeNull();
    expect(pathsOf(at("ABC"))).toBeNull();
    expect(pathsOf(at("A".repeat(10)))).toBeNull();
    expect(pathsOf(at("12345"))).toBeNull();
  });

  it("[BR-K2] country rules", () => {
    const at = (v: unknown) =>
      mutate((b) => ((b.shipping as { country: unknown }).country = v));
    expect(pathsOf(at("FR"))).toEqual(["shipping.country"]);
    expect(messagesOf(at("FR"))).toEqual(["Select your country"]);
    expect(pathsOf(at(""))).toEqual(["shipping.country"]);
    expect(pathsOf(at(undefined))).toEqual(["shipping.country"]);
    expect(pathsOf(at("us"))).toEqual(["shipping.country"]);
    for (const c of ["US", "CA", "GB", "DE", "NL"]) {
      expect(pathsOf(at(c))).toBeNull();
    }
  });

  it("[BR-K3] card number rules", () => {
    const at = (v: unknown) =>
      mutate((b) => ((b.payment as { cardNumber: unknown }).cardNumber = v));
    expect(messagesOf(at(" "))).toEqual(["Enter your card number"]);
    expect(pathsOf(at(undefined))).toEqual(["payment.cardNumber"]);
    expect(messagesOf(at("4242424242424241"))).toEqual([
      "Enter a valid card number",
    ]);
    expect(pathsOf(at("4242424242424241"))).toEqual(["payment.cardNumber"]);
    expect(pathsOf(at("424242424242424"))).toEqual(["payment.cardNumber"]);
    expect(pathsOf(at("42424242424242424"))).toEqual(["payment.cardNumber"]);
    expect(pathsOf(at("42424242424242426"))).toEqual(["payment.cardNumber"]);
    expect(pathsOf(at("4242-4242-4242-4242"))).toEqual(["payment.cardNumber"]);
    expect(pathsOf(at("4242424242424a42"))).toEqual(["payment.cardNumber"]);
    expect(pathsOf(at("4242 4242 4242 4242"))).toBeNull();
    expect(pathsOf(at("4000000000000002"))).toBeNull();
    expect(pathsOf(at("0000000000000000"))).toBeNull();
  });

  it("[BR-K3] expiry rules", () => {
    const at = (v: unknown) =>
      mutate((b) => ((b.payment as { expiry: unknown }).expiry = v));
    expect(messagesOf(at(" "))).toEqual(["Enter the card expiry date"]);
    expect(pathsOf(at(undefined))).toEqual(["payment.expiry"]);
    expect(messagesOf(at("1/40"))).toEqual(["Enter the expiry as MM/YY"]);
    expect(messagesOf(at("13/40"))).toEqual(["Enter the expiry as MM/YY"]);
    expect(messagesOf(at("01/20"))).toEqual(["Your card has expired"]);
    expect(pathsOf(at("01/20"))).toEqual(["payment.expiry"]);
    expect(pathsOf(at("09/26"))).toEqual(["payment.expiry"]);
    expect(pathsOf(at("10/26"))).toBeNull();
    expect(pathsOf(at("11/26"))).toBeNull();
    expect(pathsOf(at("12/99"))).toBeNull();
  });

  it("[BR-K3] expiry uses the supplied clock", () => {
    const later = placeOrderSchema(new Date("2026-11-01T00:00:00.000Z"));
    const body = mutate((b) => (b.payment.expiry = "10/26"));
    expect(later.safeParse(body).success).toBe(false);
    const edge = placeOrderSchema(new Date("2026-10-31T23:59:59.999Z"));
    expect(edge.safeParse(body).success).toBe(true);
  });

  it("[BR-K3] cvc rules", () => {
    const at = (v: unknown) =>
      mutate((b) => ((b.payment as { cvc: unknown }).cvc = v));
    expect(messagesOf(at(" "))).toEqual(["Enter the CVC"]);
    expect(pathsOf(at(undefined))).toEqual(["payment.cvc"]);
    expect(messagesOf(at("12"))).toEqual(["Enter a valid 3 digit CVC"]);
    expect(pathsOf(at("12"))).toEqual(["payment.cvc"]);
    expect(pathsOf(at("1234"))).toEqual(["payment.cvc"]);
    expect(pathsOf(at("12a"))).toEqual(["payment.cvc"]);
    expect(pathsOf(at("000"))).toBeNull();
  });

  it("[BR-K1] [BR-K2] lines rules", () => {
    const at = (v: unknown) =>
      mutate((b) => ((b as { lines: unknown }).lines = v));
    expect(pathsOf(at([]))).toEqual(["lines"]);
    expect(pathsOf(at(undefined))).toEqual(["lines"]);
    expect(pathsOf(at("x"))).toEqual(["lines"]);
    expect(pathsOf(at([null]))).toEqual(["lines.0"]);
  });

  it("[BR-C2] [BR-K2] quantity rules", () => {
    const at = (q: unknown) =>
      mutate((b) => ((b.lines[0] as { quantity: unknown }).quantity = q));
    for (const q of [0, 11, 1.5, -1, "1", null, Number.NaN, 999]) {
      expect(pathsOf(at(q))).toEqual(["lines.0.quantity"]);
    }
    expect(pathsOf(at(undefined))).toEqual(["lines.0.quantity"]);
    expect(pathsOf(at(1))).toBeNull();
    expect(pathsOf(at(10))).toBeNull();
  });

  it("[BR-K2] product id rules", () => {
    const at = (v: unknown) =>
      mutate((b) => ((b.lines[0] as { productId: unknown }).productId = v));
    for (const v of [0, -1, 1.5, "1", undefined]) {
      expect(pathsOf(at(v))).toEqual(["lines.0.productId"]);
    }
    expect(pathsOf(at(1))).toBeNull();
  });

  it("[BR-K2] unit price rules", () => {
    const at = (v: unknown) =>
      mutate(
        (b) => ((b.lines[0] as { unitPriceCents: unknown }).unitPriceCents = v),
      );
    for (const v of [-1, 1.5, 0, "100", undefined]) {
      expect(pathsOf(at(v))).toEqual(["lines.0.unitPriceCents"]);
    }
    expect(pathsOf(at(1))).toBeNull();
  });

  it("[BR-K2] rejects duplicate product ids", () => {
    const body = mutate((b) => {
      b.lines = [
        { productId: 1, quantity: 1, unitPriceCents: 1800 },
        { productId: 1, quantity: 2, unitPriceCents: 1800 },
      ];
    });
    expect(pathsOf(body)).toEqual(["lines"]);
    expect(messagesOf(body)).toEqual(["Duplicate products"]);
  });

  it("[BR-K2] accepts several distinct lines", () => {
    const body = mutate((b) => {
      b.lines = [
        { productId: 1, quantity: 1, unitPriceCents: 1800 },
        { productId: 2, quantity: 2, unitPriceCents: 2500 },
      ];
    });
    expect(pathsOf(body)).toBeNull();
  });

  it("[BR-K2] the first failing rule decides per field", () => {
    const body = mutate((b) => {
      b.contact.email = "";
      b.shipping.fullName = "";
      b.payment.cardNumber = "";
      b.payment.expiry = "";
      b.payment.cvc = "";
    });
    expect(messagesOf(body)).toEqual([
      "Enter your email address",
      "Enter your full name",
      "Enter your card number",
      "Enter the card expiry date",
      "Enter the CVC",
    ]);
  });

  it("[BR-K2] reports unique paths in issue order", () => {
    const body = mutate((b) => {
      b.contact.email = "x";
      b.shipping.city = "";
      b.payment.cvc = "1";
      b.lines = [
        { productId: 1, quantity: 0, unitPriceCents: 1 },
        { productId: 1, quantity: 1, unitPriceCents: 1 },
      ];
    });
    expect(pathsOf(body)).toEqual([
      "contact.email",
      "shipping.city",
      "payment.cvc",
      "lines.0.quantity",
      "lines",
    ]);
  });
});

describe("validationFieldPaths", () => {
  it("[BR-K2] dedupes repeated paths", () => {
    const result = schema.safeParse(
      mutate((b) => {
        b.lines = [
          { productId: 1, quantity: 1, unitPriceCents: 1 },
          { productId: 1, quantity: 1, unitPriceCents: 1 },
          { productId: 1, quantity: 1, unitPriceCents: 1 },
        ];
      }),
    );
    expect(result.success).toBe(false);
    expect(result.success ? [] : validationFieldPaths(result.error)).toEqual([
      "lines",
    ]);
  });

  it("[BR-K2] keeps first occurrence order for repeated paths", () => {
    const issue = (path: (string | number)[]) =>
      ({ code: "custom", message: "x", path }) as const;
    const error = new z.ZodError([
      issue(["a"]),
      issue(["b", 0, "c"]),
      issue(["a"]),
      issue(["b", 0, "c"]),
    ]);
    expect(validationFieldPaths(error)).toEqual(["a", "b.0.c"]);
  });
});
