import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readCart, writeCart } from "./cart-store";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const get = vi.fn();
const set = vi.fn();

const line = {
  productId: 7,
  slug: "lavender-dusk",
  quantity: 2,
  unitPriceCents: 1800,
};

beforeEach(() => {
  get.mockReset();
  set.mockReset();
  vi.mocked(cookies).mockResolvedValue({ get, set } as never);
});

describe("cart store", () => {
  it("reads the cart cookie by name", async () => {
    get.mockReturnValue({ name: "cart", value: JSON.stringify([line]) });

    await expect(readCart()).resolves.toEqual([line]);
    expect(get).toHaveBeenCalledWith("cart");
  });

  it("reads an empty cart when there is no cookie", async () => {
    get.mockReturnValue(undefined);

    await expect(readCart()).resolves.toEqual([]);
  });

  it("reads an empty cart when the cookie is tampered with", async () => {
    get.mockReturnValue({ name: "cart", value: "{{{" });

    await expect(readCart()).resolves.toEqual([]);
  });

  it("[BR-C4] writes the cart as an http only lax cookie for 30 days", async () => {
    await writeCart([line]);

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("cart", JSON.stringify([line]), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 2592000,
    });
  });

  it("[BR-C4] writes an empty cart as an empty list", async () => {
    await writeCart([]);

    expect(set).toHaveBeenCalledWith("cart", "[]", expect.any(Object));
  });
});
