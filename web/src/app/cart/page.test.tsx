import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateQuantity } from "@/features/cart/cart-actions";
import { parseCartCookie, type CartLine } from "@/features/cart/cart-cookie";
import { readCart } from "@/features/cart/cart-store";
import { getProduct } from "@/lib/backend/client";
import {
  BackendContractError,
  BackendUnavailableError,
} from "@/lib/backend/errors";
import type { ProductDetail } from "@/lib/backend/schemas";
import { lavenderDusk } from "@/test/fixtures";
import CartPage, { metadata } from "./page";

vi.mock("@/features/cart/cart-store", () => ({ readCart: vi.fn() }));
vi.mock("@/lib/backend/client", () => ({ getProduct: vi.fn() }));
vi.mock("@/features/cart/cart-actions", () => ({
  updateQuantity: vi.fn(),
  removeFromCart: vi.fn(),
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

const CAP_MESSAGE = "You can buy at most 10 of Lavender Dusk.";

function cartHolds(lines: CartLine[]): void {
  vi.mocked(readCart).mockResolvedValue(lines);
}

function definitions(): (string | null)[] {
  return screen.getAllByRole("definition").map((item) => item.textContent);
}

function expectEmptyCart(): void {
  expect(
    screen.getByRole("heading", { level: 1, name: "Your cart" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Continue shopping" }),
  ).toHaveAttribute("href", "/");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Checkout" }),
  ).not.toBeInTheDocument();
  expect(screen.queryAllByRole("definition")).toHaveLength(0);
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
}

async function clampLavender(): Promise<void> {
  vi.mocked(updateQuantity).mockResolvedValueOnce({
    status: "clamped",
    message: CAP_MESSAGE,
    submittedQuantity: "15",
  });
  const input = screen.getByRole("spinbutton", {
    name: "Quantity for Lavender Dusk",
  });
  fireEvent.input(input, { target: { value: "15" } });
  fireEvent.change(input);
  await screen.findByText(CAP_MESSAGE);
}

beforeEach(() => {
  vi.mocked(readCart).mockReset();
  vi.mocked(getProduct).mockReset();
  vi.mocked(updateQuantity).mockReset();
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

describe("cart page", () => {
  it("[BR-C5] has the cart title and the default description", () => {
    expect(metadata).toEqual({
      title: "Your cart | Wick & Co. Candles",
      description:
        "Hand poured candles in floral, woody, fresh, gourmand and spicy scents.",
    });
  });

  it("[BR-C7] empty cart shows the empty state", async () => {
    cartHolds([]);

    render(await CartPage());

    expectEmptyCart();
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("[BR-C7] shows the empty state when no product in the cart exists any more", async () => {
    cartHolds([{ ...lavenderLine, slug: "retired-candle" }]);

    render(await CartPage());

    expectEmptyCart();
    expect(getProduct).toHaveBeenCalledWith("retired-candle");
  });

  it("[BR-C5] renders a row per line, the totals and the checkout link", async () => {
    cartHolds([lavenderLine, orangeLine]);

    render(await CartPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Your cart" }),
    ).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(
      screen.getByRole("spinbutton", { name: "Quantity for Lavender Dusk" }),
    ).toHaveValue(2);
    expect(
      screen.getByRole("spinbutton", { name: "Quantity for Orange Grove" }),
    ).toHaveValue(1);
    expect(definitions()).toEqual(["$54.30", "Free", "$54.30"]);
    expect(screen.getByRole("link", { name: "Checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument();
  });

  it("[BR-C5] charges shipping and totals only the lines whose product still exists", async () => {
    cartHolds([
      lavenderLine,
      {
        productId: 21,
        slug: "retired-candle",
        quantity: 4,
        unitPriceCents: 3000,
      },
    ]);

    render(await CartPage());

    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(definitions()).toEqual(["$32.30", "$5.95", "$38.25"]);
  });

  it("drops a cookie line with a tampered price and still renders the cart", async () => {
    const cookie = JSON.stringify([
      { ...lavenderLine, quantity: 10, unitPriceCents: 9007199254740991 },
      orangeLine,
    ]);
    vi.mocked(readCart).mockImplementation(() =>
      Promise.resolve(parseCartCookie(cookie)),
    );

    render(await CartPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Your cart" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(
      screen.queryByRole("spinbutton", { name: "Quantity for Lavender Dusk" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: "Quantity for Orange Grove" }),
    ).toHaveValue(1);
    expect(definitions()).toEqual(["$22.00", "$5.95", "$27.95"]);
    expect(getProduct).not.toHaveBeenCalledWith("lavender-dusk");
  });

  it("[BR-C2] takes the cap from the fresh product", async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...lavenderDusk, stock: 3 });
    cartHolds([lavenderLine]);

    render(await CartPage());

    expect(
      screen.getByRole("spinbutton", { name: "Quantity for Lavender Dusk" }),
    ).toHaveAttribute("max", "3");
  });

  it("[BR-C2] sends quantity changes to updateQuantity and shows its message in the one status region", async () => {
    cartHolds([lavenderLine]);
    render(await CartPage());

    await clampLavender();

    expect(updateQuantity).toHaveBeenCalledWith({
      productId: 7,
      quantity: "15",
    });
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(CAP_MESSAGE);
  });

  it("[BR-C2] keeps the cap message when the cart re-renders with the same lines", async () => {
    cartHolds([lavenderLine, orangeLine]);
    const { rerender } = render(await CartPage());
    await clampLavender();

    cartHolds([{ ...lavenderLine, quantity: 10 }, orangeLine]);
    rerender(await CartPage());

    expect(screen.getByRole("status")).toHaveTextContent(CAP_MESSAGE);
    expect(
      screen.getByRole("spinbutton", { name: "Quantity for Lavender Dusk" }),
    ).toHaveValue(10);
  });

  it("[BR-C3] removes the cap message with the line", async () => {
    cartHolds([lavenderLine, orangeLine]);
    const { rerender } = render(await CartPage());
    await clampLavender();

    cartHolds([lavenderLine]);
    rerender(await CartPage());

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("[BR-C3] shows the empty state with an empty status region after the last line goes", async () => {
    cartHolds([lavenderLine]);
    const { rerender } = render(await CartPage());
    await clampLavender();

    cartHolds([]);
    rerender(await CartPage());

    expectEmptyCart();
  });

  it("lets a backend outage reach the error page", async () => {
    const outage = new BackendUnavailableError("Backend request failed");
    vi.mocked(getProduct).mockRejectedValue(outage);
    cartHolds([lavenderLine]);

    await expect(CartPage()).rejects.toBe(outage);
  });

  it("lets a contract violation from the backend reach the error page", async () => {
    const broken = new BackendContractError("Backend body does not match");
    vi.mocked(getProduct).mockRejectedValue(broken);
    cartHolds([lavenderLine]);

    await expect(CartPage()).rejects.toBe(broken);
  });
});
