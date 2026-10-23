import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProduct } from "@/lib/backend/client";
import {
  BackendContractError,
  BackendUnavailableError,
} from "@/lib/backend/errors";
import type { ProductDetail } from "@/lib/backend/schemas";
import { lavenderDusk } from "@/test/fixtures";
import type { CartLine } from "./cart-cookie";
import { buildCartView, fetchCartProducts } from "./cart-view";

vi.mock("@/lib/backend/client", () => ({ getProduct: vi.fn() }));

const orangeGrove: ProductDetail = {
  ...lavenderDusk,
  id: 9,
  slug: "orange-grove",
  name: "Orange Grove",
  priceCents: 2200,
  stock: 3,
};

const lavenderLine: CartLine = {
  productId: 7,
  slug: "lavender-dusk",
  quantity: 2,
  unitPriceCents: 1500,
};

const orangeLine: CartLine = {
  productId: 9,
  slug: "orange-grove",
  quantity: 3,
  unitPriceCents: 2200,
};

function catalog(
  entries: [string, ProductDetail | null][],
): ReadonlyMap<string, ProductDetail | null> {
  return new Map(entries);
}

beforeEach(() => {
  vi.mocked(getProduct).mockReset();
});

describe("buildCartView", () => {
  it("builds rows and drops lines for missing products", () => {
    const rows = buildCartView(
      [
        lavenderLine,
        orangeLine,
        { ...orangeLine, productId: 11, slug: "gone" },
      ],
      catalog([
        ["lavender-dusk", lavenderDusk],
        ["orange-grove", orangeGrove],
        ["gone", null],
      ]),
    );

    expect(rows).toEqual([
      {
        productId: 7,
        slug: "lavender-dusk",
        name: "Lavender Dusk",
        unitPriceCents: 1500,
        quantity: 2,
        lineTotalCents: 3000,
        cap: 10,
      },
      {
        productId: 9,
        slug: "orange-grove",
        name: "Orange Grove",
        unitPriceCents: 2200,
        quantity: 3,
        lineTotalCents: 6600,
        cap: 3,
      },
    ]);
  });

  it("[BR-C5] keeps the price of the line, not the current price of the product", () => {
    const [row] = buildCartView(
      [lavenderLine],
      catalog([["lavender-dusk", { ...lavenderDusk, priceCents: 9900 }]]),
    );

    expect(row?.unitPriceCents).toBe(1500);
    expect(row?.lineTotalCents).toBe(3000);
  });

  it("[BR-C2] takes the name and the cap from the fresh product", () => {
    const [row] = buildCartView(
      [lavenderLine],
      catalog([
        [
          "lavender-dusk",
          { ...lavenderDusk, name: "Lavender Dusk Reserve", stock: 4 },
        ],
      ]),
    );

    expect(row?.name).toBe("Lavender Dusk Reserve");
    expect(row?.cap).toBe(4);
  });

  it("[BR-C2] gives a sold out product a cap of 0 and keeps its line", () => {
    const rows = buildCartView(
      [lavenderLine],
      catalog([["lavender-dusk", { ...lavenderDusk, stock: 0 }]]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.cap).toBe(0);
    expect(rows[0]?.quantity).toBe(2);
  });

  it("drops a line whose product was never looked up", () => {
    expect(buildCartView([lavenderLine], catalog([]))).toEqual([]);
  });

  it("drops a line whose slug now names a different product", () => {
    expect(
      buildCartView(
        [{ ...lavenderLine, productId: 99 }],
        catalog([["lavender-dusk", lavenderDusk]]),
      ),
    ).toEqual([]);
  });

  it("keeps the order of the cart lines", () => {
    const rows = buildCartView(
      [orangeLine, lavenderLine],
      catalog([
        ["lavender-dusk", lavenderDusk],
        ["orange-grove", orangeGrove],
      ]),
    );

    expect(rows.map((row) => row.slug)).toEqual([
      "orange-grove",
      "lavender-dusk",
    ]);
  });

  it("builds no rows for an empty cart", () => {
    expect(
      buildCartView([], catalog([["lavender-dusk", lavenderDusk]])),
    ).toEqual([]);
  });
});

describe("fetchCartProducts", () => {
  it("looks each slug up once and maps it to its product", async () => {
    vi.mocked(getProduct).mockImplementation((slug) =>
      Promise.resolve(slug === "lavender-dusk" ? lavenderDusk : null),
    );

    const products = await fetchCartProducts([
      lavenderLine,
      { ...lavenderLine, productId: 12 },
      orangeLine,
    ]);

    expect(vi.mocked(getProduct).mock.calls).toEqual([
      ["lavender-dusk"],
      ["orange-grove"],
    ]);
    expect([...products]).toEqual([
      ["lavender-dusk", lavenderDusk],
      ["orange-grove", null],
    ]);
  });

  it("starts every lookup before any of them answers", async () => {
    const answers: ((product: ProductDetail | null) => void)[] = [];
    vi.mocked(getProduct).mockImplementation(
      () =>
        new Promise((resolve) => {
          answers.push(resolve);
        }),
    );

    const pending = fetchCartProducts([lavenderLine, orangeLine]);

    expect(getProduct).toHaveBeenCalledTimes(2);
    answers[1]?.(orangeGrove);
    answers[0]?.(lavenderDusk);
    await expect(pending).resolves.toEqual(
      new Map([
        ["lavender-dusk", lavenderDusk],
        ["orange-grove", orangeGrove],
      ]),
    );
  });

  it("does not call the backend for an empty cart", async () => {
    await expect(fetchCartProducts([])).resolves.toEqual(new Map());
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("lets a backend outage reach the error page", async () => {
    const outage = new BackendUnavailableError("down");
    vi.mocked(getProduct).mockRejectedValue(outage);

    await expect(fetchCartProducts([lavenderLine])).rejects.toBe(outage);
  });

  it("lets a contract violation reach the error page", async () => {
    const broken = new BackendContractError("bad shape");
    vi.mocked(getProduct).mockResolvedValueOnce(lavenderDusk);
    vi.mocked(getProduct).mockRejectedValueOnce(broken);

    await expect(fetchCartProducts([lavenderLine, orangeLine])).rejects.toBe(
      broken,
    );
  });
});
