import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProduct } from "@/lib/backend/client";
import {
  BackendContractError,
  BackendUnavailableError,
} from "@/lib/backend/errors";
import { lavenderDusk } from "@/test/fixtures";
import ProductPage, { generateMetadata } from "./page";

const requestCache = vi.hoisted(() => ({
  stores: [] as Map<string, unknown>[],
}));

vi.mock(import("react"), async (importOriginal) => {
  const actual = await importOriginal();
  const perRequest = (fn: (...args: unknown[]) => unknown) => {
    const store = new Map<string, unknown>();
    requestCache.stores.push(store);
    return (...args: unknown[]): unknown => {
      const key = JSON.stringify(args);
      if (!store.has(key)) store.set(key, fn(...args));
      return store.get(key);
    };
  };
  return { ...actual, cache: perRequest as typeof actual.cache };
});
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/lib/backend/client", () => ({ getProduct: vi.fn() }));
vi.mock("@/features/cart/cart-actions", () => ({ addToCart: vi.fn() }));

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

function props(slug: string) {
  return {
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve({}),
  };
}

beforeEach(() => {
  for (const store of requestCache.stores) store.clear();
  vi.mocked(getProduct).mockReset();
  vi.mocked(getProduct).mockResolvedValue(lavenderDusk);
  vi.mocked(notFound).mockReset();
  vi.mocked(notFound).mockImplementation(() => {
    throw new Error(NOT_FOUND);
  });
});

describe("product detail page", () => {
  it("[BR-B6] renders the details of the product in the URL with one empty status region", async () => {
    render(await ProductPage(props("lavender-dusk")));

    expect(getProduct).toHaveBeenCalledWith("lavender-dusk");
    expect(
      screen.getByRole("heading", { level: 1, name: "Lavender Dusk" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Burn time: 45 hours")).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: "Quantity" }),
    ).toHaveAttribute("max", "10");
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("[BR-B8] an out of stock product page disables the quantity and the button", async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...lavenderDusk, stock: 0 });

    render(await ProductPage(props("lavender-dusk")));

    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Quantity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  });

  it("[BR-B7] an unknown product reaches the not found page", async () => {
    vi.mocked(getProduct).mockResolvedValue(null);

    await expect(ProductPage(props("no-such-candle"))).rejects.toThrow(
      NOT_FOUND,
    );
    expect(getProduct).toHaveBeenCalledWith("no-such-candle");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("[BR-B7] the metadata of an unknown product reaches the not found page too", async () => {
    vi.mocked(getProduct).mockResolvedValue(null);

    await expect(generateMetadata(props("no-such-candle"))).rejects.toThrow(
      NOT_FOUND,
    );
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("[BR-B9] titles the page after the product and describes it with its summary", async () => {
    await expect(generateMetadata(props("lavender-dusk"))).resolves.toEqual({
      title: "Lavender Dusk | Wick & Co. Candles",
      description: "Soft lavender with a warm vanilla base.",
    });
    expect(getProduct).toHaveBeenCalledWith("lavender-dusk");
  });

  it("[BR-B9] keeps the product name as written in the title", async () => {
    vi.mocked(getProduct).mockResolvedValue({
      ...lavenderDusk,
      slug: "ember-clove",
      name: "Ember & Clove",
      summary: "Glowing clove and orange peel on dark amber.",
    });

    await expect(generateMetadata(props("ember-clove"))).resolves.toEqual({
      title: "Ember & Clove | Wick & Co. Candles",
      description: "Glowing clove and orange peel on dark amber.",
    });
  });

  it("looks the product up once for the page and its metadata", async () => {
    await generateMetadata(props("lavender-dusk"));
    render(await ProductPage(props("lavender-dusk")));

    expect(getProduct).toHaveBeenCalledTimes(1);
    expect(getProduct).toHaveBeenCalledWith("lavender-dusk");
  });

  it("looks up each slug on its own", async () => {
    await generateMetadata(props("lavender-dusk"));
    await generateMetadata(props("ember-clove"));

    expect(vi.mocked(getProduct).mock.calls).toEqual([
      ["lavender-dusk"],
      ["ember-clove"],
    ]);
  });

  it("a backend outage reaches the error page instead of not found", async () => {
    const outage = new BackendUnavailableError("Backend request failed");
    vi.mocked(getProduct).mockRejectedValue(outage);

    await expect(ProductPage(props("lavender-dusk"))).rejects.toBe(outage);
    await expect(generateMetadata(props("lavender-dusk"))).rejects.toBe(outage);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("a contract violation from the backend also reaches the error page", async () => {
    const broken = new BackendContractError("Backend body does not match");
    vi.mocked(getProduct).mockRejectedValue(broken);

    await expect(ProductPage(props("lavender-dusk"))).rejects.toBe(broken);
    expect(notFound).not.toHaveBeenCalled();
  });
});
