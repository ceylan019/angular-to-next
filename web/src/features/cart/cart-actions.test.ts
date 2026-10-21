import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProduct } from "@/lib/backend/client";
import {
  BackendContractError,
  BackendUnavailableError,
} from "@/lib/backend/errors";
import { lavenderDusk } from "@/test/fixtures";
import { addToCart } from "./cart-actions";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/backend/client", () => ({ getProduct: vi.fn() }));

const get = vi.fn();
const set = vi.fn();

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function existingCart(lines: unknown): void {
  get.mockReturnValue({ name: "cart", value: JSON.stringify(lines) });
}

function writtenCart(): unknown {
  const call = set.mock.calls[0] as [string, string] | undefined;
  return call ? JSON.parse(call[1]) : undefined;
}

const idle = { status: "idle" } as const;

beforeEach(() => {
  get.mockReset();
  set.mockReset();
  vi.mocked(getProduct).mockReset();
  vi.mocked(cookies).mockResolvedValue({ get, set } as never);
  vi.mocked(getProduct).mockResolvedValue(lavenderDusk);
});

describe("addToCart", () => {
  it("[BR-C1] writes the cookie and returns the added message", async () => {
    const result = await addToCart(
      idle,
      form({ slug: "lavender-dusk", quantity: "2" }),
    );

    expect(result).toEqual({
      status: "added",
      message: "Added Lavender Dusk to your cart.",
    });
    expect(getProduct).toHaveBeenCalledWith("lavender-dusk");
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0]?.[0]).toBe("cart");
    expect(writtenCart()).toEqual([
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 2,
        unitPriceCents: 1615,
      },
    ]);
  });

  it("[BR-C1] adds 1 when no quantity is sent, as the list does", async () => {
    const result = await addToCart(idle, form({ slug: "lavender-dusk" }));

    expect(result.status).toBe("added");
    expect(writtenCart()).toEqual([
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 1,
        unitPriceCents: 1615,
      },
    ]);
  });

  it("[BR-C1] merges with the existing line at the current price", async () => {
    existingCart([
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 3,
        unitPriceCents: 1400,
      },
      { productId: 9, slug: "cedar-hearth", quantity: 1, unitPriceCents: 2000 },
    ]);

    await addToCart(idle, form({ slug: "lavender-dusk", quantity: "4" }));

    expect(writtenCart()).toEqual([
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 7,
        unitPriceCents: 1615,
      },
      { productId: 9, slug: "cedar-hearth", quantity: 1, unitPriceCents: 2000 },
    ]);
  });

  it("[BR-C1] sanitizes a tampered cookie while adding", async () => {
    get.mockReturnValue({ name: "cart", value: "{{{" });

    const result = await addToCart(idle, form({ slug: "lavender-dusk" }));

    expect(result.status).toBe("added");
    expect(writtenCart()).toHaveLength(1);
  });

  it("[BR-C2] treats an invalid quantity as 1", async () => {
    for (const quantity of ["0", "-5", "2.5", "abc", ""]) {
      set.mockReset();
      await addToCart(idle, form({ slug: "lavender-dusk", quantity }));
      expect(writtenCart()).toEqual([
        {
          productId: 7,
          slug: "lavender-dusk",
          quantity: 1,
          unitPriceCents: 1615,
        },
      ]);
    }
  });

  it("[BR-C2] returns the cap message when clamped", async () => {
    const result = await addToCart(
      idle,
      form({ slug: "lavender-dusk", quantity: "12" }),
    );

    expect(result).toEqual({
      status: "clamped",
      message: "You can buy at most 10 of Lavender Dusk.",
    });
    expect(writtenCart()).toEqual([
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 10,
        unitPriceCents: 1615,
      },
    ]);
  });

  it("[BR-C2] clamps to stock below 10 and still writes the cookie", async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...lavenderDusk, stock: 3 });
    existingCart([
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 3,
        unitPriceCents: 1615,
      },
    ]);

    const result = await addToCart(
      idle,
      form({ slug: "lavender-dusk", quantity: "1" }),
    );

    expect(result).toEqual({
      status: "clamped",
      message: "You can buy at most 3 of Lavender Dusk.",
    });
    expect(set).toHaveBeenCalledTimes(1);
    expect(writtenCart()).toEqual([
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 3,
        unitPriceCents: 1615,
      },
    ]);
  });

  it("[BR-B8] refuses an unknown product and leaves the cookie untouched", async () => {
    vi.mocked(getProduct).mockResolvedValue(null);

    const result = await addToCart(idle, form({ slug: "no-such-candle" }));

    expect(result).toEqual({ status: "error" });
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-B8] refuses an out of stock product and leaves the cookie untouched", async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...lavenderDusk, stock: 0 });

    const result = await addToCart(idle, form({ slug: "lavender-dusk" }));

    expect(result).toEqual({ status: "error" });
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-B8] refuses missing or malformed slugs without calling the backend", async () => {
    const bad: FormData[] = [
      form({}),
      form({ quantity: "2" }),
      form({ slug: "" }),
      form({ slug: "Lavender Dusk" }),
      form({ slug: "UPPER" }),
      form({ slug: "-lead" }),
      form({ slug: "../etc/passwd" }),
      form({ slug: "a/b" }),
      form({ slug: "a?b=c" }),
      form({ slug: new File(["x"], "lavender-dusk") }),
    ];

    for (const data of bad) {
      await expect(addToCart(idle, data)).resolves.toEqual({
        status: "error",
      });
    }
    expect(getProduct).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-B8] returns an error and keeps the cookie when the backend is unavailable", async () => {
    vi.mocked(getProduct).mockRejectedValue(
      new BackendUnavailableError("down"),
    );

    const result = await addToCart(idle, form({ slug: "lavender-dusk" }));

    expect(result).toEqual({ status: "error" });
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-B8] rethrows a backend contract error without touching the cookie", async () => {
    const failure = new BackendContractError("bad shape");
    vi.mocked(getProduct).mockRejectedValue(failure);

    await expect(addToCart(idle, form({ slug: "lavender-dusk" }))).rejects.toBe(
      failure,
    );
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-B8] rethrows unexpected errors", async () => {
    const failure = new TypeError("boom");
    vi.mocked(getProduct).mockRejectedValue(failure);

    await expect(addToCart(idle, form({ slug: "lavender-dusk" }))).rejects.toBe(
      failure,
    );
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C1] ignores the previous state", async () => {
    const result = await addToCart(
      { status: "error" },
      form({ slug: "lavender-dusk" }),
    );

    expect(result.status).toBe("added");
  });
});
