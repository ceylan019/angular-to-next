import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartLine } from "@/features/cart/cart-cookie";
import { readCart } from "@/features/cart/cart-store";
import { placeOrderAction } from "@/features/checkout/place-order-action";
import { getProduct } from "@/lib/backend/client";
import {
  BackendContractError,
  BackendUnavailableError,
} from "@/lib/backend/errors";
import type { ProductDetail } from "@/lib/backend/schemas";
import { lavenderDusk } from "@/test/fixtures";
import CheckoutPage, { metadata } from "./page";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/cart/cart-store", () => ({ readCart: vi.fn() }));
vi.mock("@/lib/backend/client", () => ({ getProduct: vi.fn() }));
vi.mock("@/features/checkout/place-order-action", () => ({
  placeOrderAction: vi.fn(),
}));

const orangeGrove: ProductDetail = {
  ...lavenderDusk,
  id: 9,
  slug: "orange-grove",
  name: "Orange Grove",
  priceCents: 2200,
};

const lavenderLine: CartLine = {
  productId: 7,
  slug: "lavender-dusk",
  quantity: 2,
  unitPriceCents: 1615,
};

const orangeLine: CartLine = {
  productId: 9,
  slug: "orange-grove",
  quantity: 1,
  unitPriceCents: 2200,
};

function cartHolds(lines: CartLine[]): void {
  vi.mocked(readCart).mockResolvedValue(lines);
}

function summary(): HTMLElement {
  return screen.getByRole("complementary", { name: "Order summary" });
}

function summaryLines(): (string | null)[][] {
  return within(summary())
    .getAllByRole("listitem")
    .map((item) => [...item.children].map((part) => part.textContent));
}

function definitions(): (string | null)[] {
  return within(summary())
    .getAllByRole("definition")
    .map((item) => item.textContent);
}

beforeEach(() => {
  vi.mocked(readCart).mockReset();
  vi.mocked(getProduct).mockReset();
  vi.mocked(redirect).mockReset();
  vi.mocked(placeOrderAction).mockReset();
  vi.mocked(redirect).mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT;${url}`);
  });
  vi.mocked(getProduct).mockImplementation((slug) =>
    Promise.resolve(
      slug === "lavender-dusk"
        ? lavenderDusk
        : slug === "orange-grove"
          ? orangeGrove
          : null,
    ),
  );
});

describe("checkout page", () => {
  it("[BR-B9] has the checkout title and the default description", () => {
    expect(metadata).toEqual({
      title: "Checkout | Wick & Co. Candles",
      description:
        "Hand poured candles in floral, woody, fresh, gourmand and spicy scents.",
    });
  });

  it("[BR-K1] redirects an empty cart to the cart page", async () => {
    cartHolds([]);

    await expect(CheckoutPage()).rejects.toThrow("NEXT_REDIRECT;/cart");

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/cart");
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("[BR-K1] redirects when no candle in the cart exists any more", async () => {
    cartHolds([{ ...lavenderLine, slug: "retired-candle" }]);

    await expect(CheckoutPage()).rejects.toThrow("NEXT_REDIRECT;/cart");

    expect(getProduct).toHaveBeenCalledWith("retired-candle");
  });

  it("[BR-K1] shows the form beside an order summary of the cart", async () => {
    cartHolds([lavenderLine, orangeLine]);

    render(await CheckoutPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Checkout" }),
    ).toBeInTheDocument();
    for (const legend of ["Contact", "Shipping address", "Payment"]) {
      expect(screen.getByRole("group", { name: legend })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled();
    expect(summaryLines()).toEqual([
      ["Lavender Dusk × 2", "$32.30"],
      ["Orange Grove × 1", "$22.00"],
    ]);
    expect(
      within(summary())
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual(["Subtotal", "Shipping", "Total"]);
    expect(definitions()).toEqual(["$54.30", "Free", "$54.30"]);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    expect(screen.queryByRole("status")).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("[BR-C5] [KD-03] charges shipping in the summary below 50 dollars", async () => {
    cartHolds([{ ...lavenderLine, quantity: 1 }]);

    render(await CheckoutPage());

    expect(summaryLines()).toEqual([["Lavender Dusk × 1", "$16.15"]]);
    expect(definitions()).toEqual(["$16.15", "$5.95", "$22.10"]);
  });

  it("[BR-K4] shows the unit prices the cart holds", async () => {
    cartHolds([{ ...lavenderLine, quantity: 1, unitPriceCents: 1900 }]);

    render(await CheckoutPage());

    expect(summaryLines()).toEqual([["Lavender Dusk × 1", "$19.00"]]);
    expect(definitions()).toEqual(["$19.00", "$5.95", "$24.95"]);
  });

  it("[BR-K1] leaves candles that no longer exist out of the summary", async () => {
    cartHolds([
      { ...orangeLine, slug: "retired-candle" },
      { ...lavenderLine, quantity: 1 },
    ]);

    render(await CheckoutPage());

    expect(summaryLines()).toEqual([["Lavender Dusk × 1", "$16.15"]]);
    expect(definitions()).toEqual(["$16.15", "$5.95", "$22.10"]);
  });

  it("[BR-K5] places the order through the place order action", async () => {
    cartHolds([lavenderLine]);
    vi.mocked(placeOrderAction).mockResolvedValue({ status: "declined" });
    render(await CheckoutPage());
    const typed: [string, string][] = [
      ["Email", "ada@example.com"],
      ["Full name", "Ada Lovelace"],
      ["Address line 1", "12 Analytical Way"],
      ["City", "London"],
      ["Postal code", "SW1A 1AA"],
      ["Country", "GB"],
      ["Card number", "4242 4242 4242 4242"],
      ["Expiry (MM/YY)", "12/40"],
      ["CVC", "123"],
    ];
    for (const [label, value] of typed) {
      fireEvent.change(screen.getByLabelText(label, { exact: true }), {
        target: { value },
      });
    }

    fireEvent.click(screen.getByRole("button", { name: "Place order" }));

    expect(
      await within(screen.getByRole("alert")).findByText(
        "Your card was declined.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(placeOrderAction).toHaveBeenCalledTimes(1);
    });
    expect(placeOrderAction).toHaveBeenCalledWith({
      email: "ada@example.com",
      fullName: "Ada Lovelace",
      line1: "12 Analytical Way",
      line2: "",
      city: "London",
      postalCode: "SW1A 1AA",
      country: "GB",
      cardNumber: "4242 4242 4242 4242",
      expiry: "12/40",
      cvc: "123",
    });
  });

  it("lets a backend outage reach the error page", async () => {
    cartHolds([lavenderLine]);
    const failure = new BackendUnavailableError("down");
    vi.mocked(getProduct).mockRejectedValue(failure);

    await expect(CheckoutPage()).rejects.toBe(failure);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("lets a contract violation from the backend reach the error page", async () => {
    cartHolds([lavenderLine]);
    const failure = new BackendContractError("bad shape");
    vi.mocked(getProduct).mockRejectedValue(failure);

    await expect(CheckoutPage()).rejects.toBe(failure);
  });
});
