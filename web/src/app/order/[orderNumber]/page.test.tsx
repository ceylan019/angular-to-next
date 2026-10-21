import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOrder } from "@/lib/backend/client";
import {
  BackendContractError,
  BackendUnavailableError,
} from "@/lib/backend/errors";
import { sampleOrder } from "@/test/fixtures";
import OrderPage, { generateMetadata } from "./page";

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
vi.mock("@/lib/backend/client", () => ({ getOrder: vi.fn() }));

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

function props(orderNumber: string) {
  return {
    params: Promise.resolve({ orderNumber }),
    searchParams: Promise.resolve({}),
  };
}

beforeEach(() => {
  for (const store of requestCache.stores) store.clear();
  vi.mocked(getOrder).mockReset();
  vi.mocked(getOrder).mockResolvedValue(sampleOrder);
  vi.mocked(notFound).mockReset();
  vi.mocked(notFound).mockImplementation(() => {
    throw new Error(NOT_FOUND);
  });
});

describe("order confirmation page", () => {
  it("[BR-K5] renders the confirmation of the order in the URL", async () => {
    render(await OrderPage(props("WC-AB12CD")));

    expect(getOrder).toHaveBeenCalledWith("WC-AB12CD");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Thank you for your order",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Order number: WC-AB12CD", { exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("definition").map((item) => item.textContent),
    ).toEqual(["$32.30", "$5.95", "$38.25"]);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("[BR-K7] an unknown order number reaches the not found page", async () => {
    vi.mocked(getOrder).mockResolvedValue(null);

    await expect(OrderPage(props("WC-NOPE00"))).rejects.toThrow(NOT_FOUND);
    expect(getOrder).toHaveBeenCalledWith("WC-NOPE00");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("[BR-K7] the metadata of an unknown order reaches the not found page too", async () => {
    vi.mocked(getOrder).mockResolvedValue(null);

    await expect(generateMetadata(props("WC-NOPE00"))).rejects.toThrow(
      NOT_FOUND,
    );
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("[BR-B9] titles the page after the order number with the default description", async () => {
    await expect(generateMetadata(props("WC-AB12CD"))).resolves.toEqual({
      title: "Order WC-AB12CD | Wick & Co. Candles",
      description:
        "Hand poured candles in floral, woody, fresh, gourmand and spicy scents.",
    });
    expect(getOrder).toHaveBeenCalledWith("WC-AB12CD");
  });

  it("looks the order up once for the page and its metadata", async () => {
    await generateMetadata(props("WC-AB12CD"));
    render(await OrderPage(props("WC-AB12CD")));

    expect(getOrder).toHaveBeenCalledTimes(1);
    expect(getOrder).toHaveBeenCalledWith("WC-AB12CD");
  });

  it("looks up each order number on its own", async () => {
    vi.mocked(getOrder).mockImplementation((orderNumber) =>
      Promise.resolve({ ...sampleOrder, orderNumber }),
    );

    await expect(generateMetadata(props("WC-AB12CD"))).resolves.toMatchObject({
      title: "Order WC-AB12CD | Wick & Co. Candles",
    });
    await expect(generateMetadata(props("WC-ZZ9900"))).resolves.toMatchObject({
      title: "Order WC-ZZ9900 | Wick & Co. Candles",
    });

    expect(vi.mocked(getOrder).mock.calls).toEqual([
      ["WC-AB12CD"],
      ["WC-ZZ9900"],
    ]);
  });

  it("a backend outage reaches the error page instead of not found", async () => {
    const outage = new BackendUnavailableError("Backend request failed");
    vi.mocked(getOrder).mockRejectedValue(outage);

    await expect(OrderPage(props("WC-AB12CD"))).rejects.toBe(outage);
    await expect(generateMetadata(props("WC-AB12CD"))).rejects.toBe(outage);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("a contract violation from the backend also reaches the error page", async () => {
    const broken = new BackendContractError("Backend body does not match");
    vi.mocked(getOrder).mockRejectedValue(broken);

    await expect(OrderPage(props("WC-AB12CD"))).rejects.toBe(broken);
    expect(notFound).not.toHaveBeenCalled();
  });
});
