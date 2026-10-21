import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProduct } from "@/lib/backend/client";
import {
  BackendContractError,
  BackendUnavailableError,
} from "@/lib/backend/errors";
import { lavenderDusk } from "@/test/fixtures";
import {
  addToCart,
  removeFromCart,
  updateQuantity,
  type QuantityChange,
} from "./cart-actions";

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
      submittedQuantity: "2",
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

    expect(result).toEqual({
      status: "added",
      message: "Added Lavender Dusk to your cart.",
      submittedQuantity: null,
    });
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
      submittedQuantity: "12",
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
      submittedQuantity: "1",
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

    expect(result).toEqual({ status: "error", submittedQuantity: null });
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-B8] refuses an out of stock product and leaves the cookie untouched", async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...lavenderDusk, stock: 0 });

    const result = await addToCart(idle, form({ slug: "lavender-dusk" }));

    expect(result).toEqual({ status: "error", submittedQuantity: null });
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C1] refuses missing or malformed slugs without calling the backend", async () => {
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
      const result = await addToCart(idle, data);
      expect(result.status).toBe("error");
      expect(result).not.toHaveProperty("message");
    }
    expect(getProduct).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C1] returns an error and keeps the cookie when the backend is unavailable", async () => {
    vi.mocked(getProduct).mockRejectedValue(
      new BackendUnavailableError("down"),
    );

    const result = await addToCart(idle, form({ slug: "lavender-dusk" }));

    expect(result).toEqual({ status: "error", submittedQuantity: null });
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C1] rethrows a backend contract error without touching the cookie", async () => {
    const failure = new BackendContractError("bad shape");
    vi.mocked(getProduct).mockRejectedValue(failure);

    await expect(addToCart(idle, form({ slug: "lavender-dusk" }))).rejects.toBe(
      failure,
    );
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C1] rethrows unexpected errors", async () => {
    const failure = new TypeError("boom");
    vi.mocked(getProduct).mockRejectedValue(failure);

    await expect(addToCart(idle, form({ slug: "lavender-dusk" }))).rejects.toBe(
      failure,
    );
    expect(set).not.toHaveBeenCalled();
  });

  it.each([["1e21"], ["9007199254740993"], ["99999999999999999999"]])(
    "[BR-C2] clamps the huge quantity %s to the cap with the cap message",
    async (quantity) => {
      const result = await addToCart(
        idle,
        form({ slug: "lavender-dusk", quantity }),
      );

      expect(result).toEqual({
        status: "clamped",
        message: "You can buy at most 10 of Lavender Dusk.",
        submittedQuantity: quantity,
      });
      expect(writtenCart()).toEqual([
        {
          productId: 7,
          slug: "lavender-dusk",
          quantity: 10,
          unitPriceCents: 1615,
        },
      ]);
    },
  );

  it("[BR-C1] ignores the previous state", async () => {
    const result = await addToCart(
      { status: "error", submittedQuantity: "4" },
      form({ slug: "lavender-dusk" }),
    );

    expect(result.status).toBe("added");
  });

  it("[BR-C1] echoes the quantity exactly as typed, so the detail form can keep it", async () => {
    const result = await addToCart(
      idle,
      form({ slug: "lavender-dusk", quantity: "02" }),
    );

    expect(result).toEqual({
      status: "added",
      message: "Added Lavender Dusk to your cart.",
      submittedQuantity: "02",
    });
    expect(writtenCart()).toEqual([
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 2,
        unitPriceCents: 1615,
      },
    ]);
  });

  it.each([["0"], ["-5"], ["2.5"], [""]])(
    "[BR-C2] echoes the invalid quantity %j as typed while adding 1",
    async (quantity) => {
      const result = await addToCart(
        idle,
        form({ slug: "lavender-dusk", quantity }),
      );

      expect(result).toEqual({
        status: "added",
        message: "Added Lavender Dusk to your cart.",
        submittedQuantity: quantity,
      });
    },
  );

  it("[BR-C1] echoes no quantity when the field is not text", async () => {
    const result = await addToCart(
      idle,
      form({ slug: "lavender-dusk", quantity: new File(["3"], "3") }),
    );

    expect(result).toEqual({
      status: "added",
      message: "Added Lavender Dusk to your cart.",
      submittedQuantity: null,
    });
    expect(writtenCart()).toEqual([
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 1,
        unitPriceCents: 1615,
      },
    ]);
  });

  it("[BR-C1] echoes the typed quantity when the slug is refused", async () => {
    const result = await addToCart(
      idle,
      form({ slug: "UPPER", quantity: "4" }),
    );

    expect(result).toEqual({ status: "error", submittedQuantity: "4" });
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("[BR-B8] echoes the typed quantity when the product is unknown or sold out", async () => {
    vi.mocked(getProduct).mockResolvedValueOnce(null);
    vi.mocked(getProduct).mockResolvedValueOnce({ ...lavenderDusk, stock: 0 });

    await expect(
      addToCart(idle, form({ slug: "no-such-candle", quantity: "5" })),
    ).resolves.toEqual({ status: "error", submittedQuantity: "5" });
    await expect(
      addToCart(idle, form({ slug: "lavender-dusk", quantity: "6" })),
    ).resolves.toEqual({ status: "error", submittedQuantity: "6" });
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C1] echoes the typed quantity when the backend is unavailable", async () => {
    vi.mocked(getProduct).mockRejectedValue(
      new BackendUnavailableError("down"),
    );

    const result = await addToCart(
      idle,
      form({ slug: "lavender-dusk", quantity: "3" }),
    );

    expect(result).toEqual({ status: "error", submittedQuantity: "3" });
  });
});

const lavenderLine = {
  productId: 7,
  slug: "lavender-dusk",
  quantity: 1,
  unitPriceCents: 1400,
};

const cedarLine = {
  productId: 9,
  slug: "cedar-hearth",
  quantity: 2,
  unitPriceCents: 2000,
};

function change(quantity: string, productId = 7): QuantityChange {
  return { productId, quantity };
}

describe("updateQuantity", () => {
  it("[BR-C2] updateQuantity clamps with the cap message", async () => {
    existingCart([lavenderLine]);

    const result = await updateQuantity(change("15"));

    expect(result).toEqual({
      status: "clamped",
      message: "You can buy at most 10 of Lavender Dusk.",
      submittedQuantity: "15",
    });
    expect(getProduct).toHaveBeenCalledWith("lavender-dusk");
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0]?.[0]).toBe("cart");
    expect(writtenCart()).toEqual([{ ...lavenderLine, quantity: 10 }]);
  });

  it("[BR-C3] updateQuantity turns 0 into 1 and removeFromCart deletes the line", async () => {
    existingCart([{ ...lavenderLine, quantity: 4 }, cedarLine]);

    const result = await updateQuantity(change("0"));

    expect(result).toEqual({ status: "updated", submittedQuantity: "0" });
    expect(writtenCart()).toEqual([
      { ...lavenderLine, quantity: 1 },
      cedarLine,
    ]);

    set.mockReset();
    existingCart([lavenderLine, cedarLine]);

    await removeFromCart(7);

    expect(set).toHaveBeenCalledTimes(1);
    expect(writtenCart()).toEqual([cedarLine]);
  });

  it("[BR-C2] clamps to stock below 10 with the cap message", async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...lavenderDusk, stock: 3 });
    existingCart([lavenderLine]);

    const result = await updateQuantity(change("9"));

    expect(result).toEqual({
      status: "clamped",
      message: "You can buy at most 3 of Lavender Dusk.",
      submittedQuantity: "9",
    });
    expect(writtenCart()).toEqual([{ ...lavenderLine, quantity: 3 }]);
  });

  it("[BR-C3] sets a valid quantity and keeps the line price and the other lines", async () => {
    existingCart([cedarLine, lavenderLine]);

    const result = await updateQuantity(change("4"));

    expect(result).toEqual({ status: "updated", submittedQuantity: "4" });
    expect(writtenCart()).toEqual([
      cedarLine,
      { ...lavenderLine, quantity: 4 },
    ]);
  });

  it("[BR-C2] accepts exactly the cap without the cap message", async () => {
    existingCart([lavenderLine]);

    const result = await updateQuantity(change("10"));

    expect(result).toEqual({ status: "updated", submittedQuantity: "10" });
    expect(writtenCart()).toEqual([{ ...lavenderLine, quantity: 10 }]);
  });

  it("[BR-C2] accepts exactly a stock cap below 10 without the cap message", async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...lavenderDusk, stock: 3 });
    existingCart([lavenderLine]);

    const result = await updateQuantity(change("3"));

    expect(result).toEqual({ status: "updated", submittedQuantity: "3" });
    expect(writtenCart()).toEqual([{ ...lavenderLine, quantity: 3 }]);
  });

  it("[BR-C2] keeps a line already at the cap there and says why", async () => {
    existingCart([{ ...lavenderLine, quantity: 10 }]);

    const result = await updateQuantity(change("15"));

    expect(result).toEqual({
      status: "clamped",
      message: "You can buy at most 10 of Lavender Dusk.",
      submittedQuantity: "15",
    });
    expect(writtenCart()).toEqual([{ ...lavenderLine, quantity: 10 }]);
  });

  it.each([["0"], ["-3"], [""], ["2.5"], ["abc"], [" "], ["1e-3"]])(
    "[BR-C3] turns the invalid quantity %j into 1 without a message",
    async (quantity) => {
      existingCart([{ ...lavenderLine, quantity: 5 }]);

      const result = await updateQuantity(change(quantity));

      expect(result).toEqual({
        status: "updated",
        submittedQuantity: quantity,
      });
      expect(writtenCart()).toEqual([{ ...lavenderLine, quantity: 1 }]);
    },
  );

  it.each([["1e21"], ["9007199254740993"], ["99999999999999999999"]])(
    "[BR-C2] clamps the huge quantity %s to the cap with the cap message",
    async (quantity) => {
      existingCart([lavenderLine]);

      const result = await updateQuantity(change(quantity));

      expect(result).toEqual({
        status: "clamped",
        message: "You can buy at most 10 of Lavender Dusk.",
        submittedQuantity: quantity,
      });
      expect(writtenCart()).toEqual([{ ...lavenderLine, quantity: 10 }]);
    },
  );

  it("[BR-C2] echoes the quantity exactly as typed", async () => {
    existingCart([lavenderLine]);

    const result = await updateQuantity(change("02"));

    expect(result).toEqual({ status: "updated", submittedQuantity: "02" });
    expect(writtenCart()).toEqual([{ ...lavenderLine, quantity: 2 }]);
  });

  it("[BR-C2] removes the line of a sold out product and never says at most 0", async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...lavenderDusk, stock: 0 });
    existingCart([lavenderLine, cedarLine]);

    const result = await updateQuantity(change("3"));

    expect(result).toEqual({ status: "updated", submittedQuantity: "3" });
    expect(result).not.toHaveProperty("message");
    expect(writtenCart()).toEqual([cedarLine]);
  });

  it("[BR-C3] refuses a product that is not in the cart without calling the backend", async () => {
    existingCart([cedarLine]);

    const result = await updateQuantity(change("3"));

    expect(result).toEqual({ status: "error", submittedQuantity: "3" });
    expect(getProduct).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C3] refuses any change to an empty or tampered cart", async () => {
    get.mockReturnValue({ name: "cart", value: "{{{" });

    await expect(updateQuantity(change("3"))).resolves.toEqual({
      status: "error",
      submittedQuantity: "3",
    });
    expect(getProduct).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C3] refuses a product that no longer exists and keeps the cookie", async () => {
    vi.mocked(getProduct).mockResolvedValue(null);
    existingCart([lavenderLine]);

    const result = await updateQuantity(change("3"));

    expect(result).toEqual({ status: "error", submittedQuantity: "3" });
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C3] refuses a line whose slug now names a different product", async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...lavenderDusk, id: 99 });
    existingCart([lavenderLine]);

    const result = await updateQuantity(change("3"));

    expect(result).toEqual({ status: "error", submittedQuantity: "3" });
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C3] looks the product up by the slug of the matching line", async () => {
    vi.mocked(getProduct).mockResolvedValue({
      ...lavenderDusk,
      id: 9,
      slug: "cedar-hearth",
      name: "Cedar Hearth",
    });
    existingCart([lavenderLine, cedarLine]);

    const result = await updateQuantity(change("12", 9));

    expect(getProduct).toHaveBeenCalledTimes(1);
    expect(getProduct).toHaveBeenCalledWith("cedar-hearth");
    expect(result).toEqual({
      status: "clamped",
      message: "You can buy at most 10 of Cedar Hearth.",
      submittedQuantity: "12",
    });
    expect(writtenCart()).toEqual([
      lavenderLine,
      { ...cedarLine, quantity: 10 },
    ]);
  });

  it("[BR-C3] returns an error and keeps the cookie when the backend is unavailable", async () => {
    vi.mocked(getProduct).mockRejectedValue(
      new BackendUnavailableError("down"),
    );
    existingCart([lavenderLine]);

    const result = await updateQuantity(change("3"));

    expect(result).toEqual({ status: "error", submittedQuantity: "3" });
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C3] rethrows a backend contract error without touching the cookie", async () => {
    const failure = new BackendContractError("bad shape");
    vi.mocked(getProduct).mockRejectedValue(failure);
    existingCart([lavenderLine]);

    await expect(updateQuantity(change("3"))).rejects.toBe(failure);
    expect(set).not.toHaveBeenCalled();
  });

  it("[BR-C3] rethrows unexpected errors", async () => {
    const failure = new TypeError("boom");
    vi.mocked(getProduct).mockRejectedValue(failure);
    existingCart([lavenderLine]);

    await expect(updateQuantity(change("3"))).rejects.toBe(failure);
    expect(set).not.toHaveBeenCalled();
  });

  it.each([
    ["a zero product id", { productId: 0, quantity: "3" }],
    ["a negative product id", { productId: -7, quantity: "3" }],
    ["a fractional product id", { productId: 7.5, quantity: "3" }],
    ["a text product id", { productId: "7", quantity: "3" }],
    ["a missing product id", { quantity: "3" }],
    [
      "a product id that is not a number",
      { productId: Number.NaN, quantity: "3" },
    ],
    ["a numeric quantity", { productId: 7, quantity: 3 }],
    ["a missing quantity", { productId: 7 }],
    ["a null quantity", { productId: 7, quantity: null }],
    ["no input at all", undefined],
    ["a null input", null],
    ["a text input", "7"],
  ])(
    "[BR-C3] refuses %s without reading the cart or calling the backend",
    async (_case, input) => {
      existingCart([lavenderLine]);

      const result = await updateQuantity(input as QuantityChange);

      expect(result).toEqual({ status: "error", submittedQuantity: null });
      expect(get).not.toHaveBeenCalled();
      expect(getProduct).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
    },
  );
});

describe("removeFromCart", () => {
  it("[BR-C3] keeps the other lines in their order", async () => {
    existingCart([
      cedarLine,
      lavenderLine,
      { productId: 11, slug: "fig-cassis", quantity: 1, unitPriceCents: 1615 },
    ]);

    await removeFromCart(7);

    expect(writtenCart()).toEqual([
      cedarLine,
      { productId: 11, slug: "fig-cassis", quantity: 1, unitPriceCents: 1615 },
    ]);
  });

  it("[BR-C3] writes an empty cart when the last line goes", async () => {
    existingCart([lavenderLine]);

    await removeFromCart(7);

    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0]?.[0]).toBe("cart");
    expect(writtenCart()).toEqual([]);
  });

  it("[BR-C3] writes the cart unchanged when the product is not in it", async () => {
    existingCart([cedarLine]);

    await removeFromCart(7);

    expect(writtenCart()).toEqual([cedarLine]);
  });

  it("[BR-C3] never calls the backend", async () => {
    existingCart([lavenderLine]);

    await expect(removeFromCart(7)).resolves.toBeUndefined();
    expect(getProduct).not.toHaveBeenCalled();
  });

  it.each([
    ["zero", 0],
    ["a negative id", -7],
    ["a fractional id", 7.5],
    ["text", "7"],
    ["not a number", Number.NaN],
    ["nothing", undefined],
    ["null", null],
  ])(
    "[BR-C3] refuses %s as a product id and leaves the cookie alone",
    async (_case, productId) => {
      existingCart([lavenderLine]);

      await removeFromCart(productId as number);

      expect(get).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
    },
  );
});
