import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartLine } from "@/features/cart/cart-cookie";
import { getProduct, placeOrder } from "@/lib/backend/client";
import {
  BackendContractError,
  BackendUnavailableError,
} from "@/lib/backend/errors";
import type { ProductDetail } from "@/lib/backend/schemas";
import { lavenderDusk, sampleOrder } from "@/test/fixtures";
import type { CheckoutValues } from "./checkout-schema";
import { placeOrderAction } from "./place-order-action";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/backend/client", () => ({
  getProduct: vi.fn(),
  placeOrder: vi.fn(),
}));

const get = vi.fn();
const set = vi.fn();

const emberClove: ProductDetail = {
  ...lavenderDusk,
  id: 9,
  slug: "ember-clove",
  name: "Ember & Clove",
  priceCents: 2000,
};

const lastLight: ProductDetail = {
  ...lavenderDusk,
  id: 11,
  slug: "last-light",
  name: "Last Light",
  priceCents: 2400,
};

const lavenderLine: CartLine = {
  productId: 7,
  slug: "lavender-dusk",
  quantity: 2,
  unitPriceCents: 1615,
};

const emberLine: CartLine = {
  productId: 9,
  slug: "ember-clove",
  quantity: 3,
  unitPriceCents: 2000,
};

const lastLightLine: CartLine = {
  productId: 11,
  slug: "last-light",
  quantity: 1,
  unitPriceCents: 2400,
};

const values: CheckoutValues = {
  email: " ada@example.com ",
  fullName: " Ada Lovelace ",
  line1: "1 Analytical Way",
  line2: "",
  city: "London",
  postalCode: "N1 9GU",
  country: "GB",
  cardNumber: "4242 4242 4242 4242",
  expiry: "12/40",
  cvc: "123",
};

const expectedInput = {
  contact: { email: "ada@example.com" },
  shipping: {
    fullName: "Ada Lovelace",
    line1: "1 Analytical Way",
    city: "London",
    postalCode: "N1 9GU",
    country: "GB",
  },
  payment: {
    cardNumber: "4242424242424242",
    expiry: "12/40",
    cvc: "123",
  },
  lines: [{ productId: 7, quantity: 2, unitPriceCents: 1615 }],
};

function outOfStockSentence(name: string): string {
  return `${name} is no longer available in the quantity you chose. We updated your cart.`;
}

function cartHolds(lines: CartLine[]): void {
  get.mockReturnValue({ name: "cart", value: JSON.stringify(lines) });
}

function writtenCart(): unknown {
  expect(set).toHaveBeenCalledTimes(1);
  const call = set.mock.calls[0] as [string, string];
  expect(call[0]).toBe("cart");
  return JSON.parse(call[1]);
}

function wroteBeforeRedirecting(): boolean {
  const wrote = set.mock.invocationCallOrder[0] ?? Infinity;
  const redirected =
    vi.mocked(redirect).mock.invocationCallOrder[0] ?? -Infinity;
  return wrote < redirected;
}

function products(...known: [string, ProductDetail | null][]): void {
  const catalog = new Map(known);
  vi.mocked(getProduct).mockImplementation((slug) =>
    Promise.resolve(catalog.get(slug) ?? null),
  );
}

beforeEach(() => {
  get.mockReset();
  set.mockReset();
  vi.mocked(getProduct).mockReset();
  vi.mocked(placeOrder).mockReset();
  vi.mocked(redirect).mockReset();
  vi.mocked(cookies).mockResolvedValue({ get, set } as never);
  vi.mocked(redirect).mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT;${url}`);
  });
  products(
    ["lavender-dusk", lavenderDusk],
    ["ember-clove", emberClove],
    ["last-light", lastLight],
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("placeOrderAction", () => {
  it("[BR-K5] clears the cart and redirects to the confirmation", async () => {
    cartHolds([lavenderLine]);
    vi.mocked(placeOrder).mockResolvedValue({
      kind: "placed",
      order: { ...sampleOrder, orderNumber: "WC-ABC123" },
    });

    await expect(placeOrderAction(values)).rejects.toThrow(
      "NEXT_REDIRECT;/order/WC-ABC123",
    );

    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(placeOrder).toHaveBeenCalledWith(expectedInput);
    expect(writtenCart()).toEqual([]);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/order/WC-ABC123");
    expect(wroteBeforeRedirecting()).toBe(true);
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("[BR-K3] returns declined and keeps the cart", async () => {
    cartHolds([lavenderLine]);
    vi.mocked(placeOrder).mockResolvedValue({ kind: "declined" });

    await expect(placeOrderAction(values)).resolves.toEqual({
      status: "declined",
    });

    expect(placeOrder).toHaveBeenCalledWith(expectedInput);
    expect(set).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("[BR-K4] adjusts the cart and names affected items", async () => {
    cartHolds([lavenderLine, emberLine]);
    vi.mocked(placeOrder).mockResolvedValue({
      kind: "out-of-stock",
      items: [{ productId: 9, available: 1 }],
    });

    await expect(placeOrderAction(values)).resolves.toEqual({
      status: "out-of-stock",
      messages: [
        "Ember & Clove is no longer available in the quantity you chose. We updated your cart.",
      ],
    });

    expect(writtenCart()).toEqual([
      lavenderLine,
      { ...emberLine, quantity: 1 },
    ]);
    expect(vi.mocked(getProduct).mock.calls).toEqual([["ember-clove"]]);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("[BR-K4] redirects to the cart when the adjustment empties it", async () => {
    cartHolds([lastLightLine]);
    vi.mocked(placeOrder).mockResolvedValue({
      kind: "out-of-stock",
      items: [{ productId: 11, available: 0 }],
    });

    await expect(placeOrderAction(values)).rejects.toThrow(
      "NEXT_REDIRECT;/cart",
    );

    expect(writtenCart()).toEqual([]);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/cart");
    expect(wroteBeforeRedirecting()).toBe(true);
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("[BR-K4] applies price changes", async () => {
    cartHolds([lavenderLine, emberLine]);
    vi.mocked(placeOrder).mockResolvedValue({
      kind: "price-changed",
      items: [{ productId: 7, unitPriceCents: 1900 }],
    });

    await expect(placeOrderAction(values)).resolves.toEqual({
      status: "price-changed",
    });

    expect(writtenCart()).toEqual([
      { ...lavenderLine, unitPriceCents: 1900 },
      emberLine,
    ]);
    expect(redirect).not.toHaveBeenCalled();
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("[BR-K2] rejects invalid values without calling the backend", async () => {
    cartHolds([lavenderLine]);

    await expect(
      placeOrderAction({ ...values, email: "ada@example", cvc: "" }),
    ).resolves.toEqual({ status: "invalid" });

    expect(placeOrder).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("[BR-K1] redirects an empty cart", async () => {
    get.mockReturnValue(undefined);

    await expect(placeOrderAction(values)).rejects.toThrow(
      "NEXT_REDIRECT;/cart",
    );

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/cart");
    expect(placeOrder).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it.each([["[]"], ["{{{"], [JSON.stringify([{ productId: 7 }])]])(
    "[BR-K1] redirects a cart cookie of %s that holds no valid line",
    async (value) => {
      get.mockReturnValue({ name: "cart", value });

      await expect(placeOrderAction(values)).rejects.toThrow(
        "NEXT_REDIRECT;/cart",
      );

      expect(placeOrder).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
    },
  );

  it("[BR-K1] redirects an empty cart before it looks at the values", async () => {
    get.mockReturnValue(undefined);

    await expect(placeOrderAction({ ...values, email: "" })).rejects.toThrow(
      "NEXT_REDIRECT;/cart",
    );

    expect(placeOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "ada@example.com"],
    ["a number", 42],
    ["an array", [values]],
    ["an empty object", {}],
    ["values with a field missing", { ...values, cvc: undefined }],
    ["values with a field that is not text", { ...values, expiry: 1240 }],
  ])(
    "[BR-K2] rejects %s without calling the backend",
    async (_label, input) => {
      cartHolds([lavenderLine]);

      await expect(
        placeOrderAction(input as unknown as CheckoutValues),
      ).resolves.toEqual({ status: "invalid" });

      expect(placeOrder).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
    },
  );

  it("[BR-K3] checks the expiry against the clock when the order is placed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    cartHolds([lavenderLine]);
    vi.mocked(placeOrder).mockResolvedValue({ kind: "declined" });

    vi.setSystemTime(new Date("2026-11-01T00:00:00.000Z"));
    await expect(
      placeOrderAction({ ...values, expiry: "10/26" }),
    ).resolves.toEqual({ status: "invalid" });
    expect(placeOrder).not.toHaveBeenCalled();

    vi.setSystemTime(new Date("2026-10-31T23:59:59.999Z"));
    await expect(
      placeOrderAction({ ...values, expiry: "10/26" }),
    ).resolves.toEqual({ status: "declined" });
    expect(placeOrder).toHaveBeenCalledTimes(1);
  });

  it("[BR-K2] returns invalid when the backend rejects the details", async () => {
    cartHolds([lavenderLine]);
    vi.mocked(placeOrder).mockResolvedValue({
      kind: "invalid",
      fields: ["email"],
    });

    await expect(placeOrderAction(values)).resolves.toEqual({
      status: "invalid",
    });

    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("[BR-K2] sends the second address line only when it has text", async () => {
    cartHolds([lavenderLine]);
    vi.mocked(placeOrder).mockResolvedValue({ kind: "declined" });

    await placeOrderAction({ ...values, line2: "  Flat 2 " });
    await placeOrderAction({
      ...values,
      line2: undefined,
    } as unknown as CheckoutValues);
    await placeOrderAction({ ...values, line2: "   " });

    expect(vi.mocked(placeOrder).mock.calls).toEqual([
      [
        {
          ...expectedInput,
          shipping: { ...expectedInput.shipping, line2: "Flat 2" },
        },
      ],
      [expectedInput],
      [expectedInput],
    ]);
  });

  it("[BR-K5] sends the lines from the cart cookie, never from the values", async () => {
    cartHolds([lavenderLine, emberLine]);
    vi.mocked(placeOrder).mockResolvedValue({ kind: "declined" });

    await placeOrderAction({
      ...values,
      lines: [{ productId: 7, quantity: 10, unitPriceCents: 1 }],
    } as unknown as CheckoutValues);

    expect(placeOrder).toHaveBeenCalledWith({
      ...expectedInput,
      lines: [
        { productId: 7, quantity: 2, unitPriceCents: 1615 },
        { productId: 9, quantity: 3, unitPriceCents: 2000 },
      ],
    });
  });

  it("[BR-K4] names every affected item in cart order, removed lines included", async () => {
    cartHolds([lavenderLine, emberLine, lastLightLine]);
    vi.mocked(placeOrder).mockResolvedValue({
      kind: "out-of-stock",
      items: [
        { productId: 11, available: 0 },
        { productId: 9, available: 2 },
        { productId: 7, available: 1 },
      ],
    });

    await expect(placeOrderAction(values)).resolves.toEqual({
      status: "out-of-stock",
      messages: [
        outOfStockSentence("Lavender Dusk"),
        outOfStockSentence("Ember & Clove"),
        outOfStockSentence("Last Light"),
      ],
    });

    expect(writtenCart()).toEqual([
      { ...lavenderLine, quantity: 1 },
      { ...emberLine, quantity: 2 },
    ]);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("[BR-K4] leaves out items it cannot name and still adjusts them", async () => {
    cartHolds([lavenderLine, emberLine, lastLightLine]);
    products(
      ["lavender-dusk", lavenderDusk],
      ["ember-clove", { ...emberClove, id: 42 }],
      ["last-light", null],
    );
    vi.mocked(placeOrder).mockResolvedValue({
      kind: "out-of-stock",
      items: [
        { productId: 7, available: 1 },
        { productId: 9, available: 1 },
        { productId: 11, available: 0 },
        { productId: 99, available: 0 },
      ],
    });

    await expect(placeOrderAction(values)).resolves.toEqual({
      status: "out-of-stock",
      messages: [outOfStockSentence("Lavender Dusk")],
    });

    expect(writtenCart()).toEqual([
      { ...lavenderLine, quantity: 1 },
      { ...emberLine, quantity: 1 },
    ]);
    expect(
      vi
        .mocked(getProduct)
        .mock.calls.map(([slug]) => slug)
        .sort(),
    ).toEqual(["ember-clove", "last-light", "lavender-dusk"]);
  });

  it("[BR-K4] stays on checkout with no sentence when the only affected candle is gone", async () => {
    cartHolds([lavenderLine, lastLightLine]);
    products(["lavender-dusk", lavenderDusk], ["last-light", null]);
    vi.mocked(placeOrder).mockResolvedValue({
      kind: "out-of-stock",
      items: [{ productId: 11, available: 0 }],
    });

    await expect(placeOrderAction(values)).resolves.toEqual({
      status: "out-of-stock",
      messages: [],
    });

    expect(writtenCart()).toEqual([lavenderLine]);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("lets a backend outage while placing the order reach the error page and keeps the cart", async () => {
    cartHolds([lavenderLine]);
    const failure = new BackendUnavailableError("down");
    vi.mocked(placeOrder).mockRejectedValue(failure);

    await expect(placeOrderAction(values)).rejects.toBe(failure);

    expect(set).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("lets a contract violation from the backend reach the error page and keeps the cart", async () => {
    cartHolds([lavenderLine]);
    const failure = new BackendContractError("bad shape");
    vi.mocked(placeOrder).mockRejectedValue(failure);

    await expect(placeOrderAction(values)).rejects.toBe(failure);

    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-K4] saves the adjusted cart before a backend outage while naming items reaches the error page", async () => {
    cartHolds([lavenderLine, emberLine]);
    const failure = new BackendUnavailableError("down");
    vi.mocked(getProduct).mockRejectedValue(failure);
    vi.mocked(placeOrder).mockResolvedValue({
      kind: "out-of-stock",
      items: [{ productId: 9, available: 1 }],
    });

    await expect(placeOrderAction(values)).rejects.toBe(failure);

    expect(writtenCart()).toEqual([
      lavenderLine,
      { ...emberLine, quantity: 1 },
    ]);
    expect(redirect).not.toHaveBeenCalled();
  });
});
