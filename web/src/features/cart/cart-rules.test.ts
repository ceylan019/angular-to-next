import { describe, expect, it } from "vitest";
import type { CartLine } from "./cart-cookie";
import {
  MAX_PER_LINE,
  addLine,
  applyPriceChanges,
  applyStockLimits,
  cartCount,
  lineCap,
  normalizeRequestedQuantity,
  removeLine,
  setLineQuantity,
} from "./cart-rules";

const lavender = {
  id: 7,
  slug: "lavender-dusk",
  priceCents: 1800,
  stock: 25,
};

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 7,
    slug: "lavender-dusk",
    quantity: 2,
    unitPriceCents: 1800,
    ...overrides,
  };
}

describe("lineCap", () => {
  it("[BR-C2] is the smaller of 10 and stock", () => {
    expect(MAX_PER_LINE).toBe(10);
    expect(lineCap(25)).toBe(10);
    expect(lineCap(11)).toBe(10);
    expect(lineCap(10)).toBe(10);
    expect(lineCap(9)).toBe(9);
    expect(lineCap(3)).toBe(3);
    expect(lineCap(1)).toBe(1);
    expect(lineCap(0)).toBe(0);
  });

  it("[BR-C2] never goes negative", () => {
    expect(lineCap(-4)).toBe(0);
  });
});

describe("normalizeRequestedQuantity", () => {
  it.each([
    ["3", 3],
    ["0", 1],
    ["-2", 1],
    ["2.5", 1],
    ["abc", 1],
    [undefined, 1],
  ])("[BR-C2] normalizes requested %s to %i", (v, n) => {
    expect(normalizeRequestedQuantity(v)).toBe(n);
  });

  it("[BR-C2] accepts whole numbers of 1 or more", () => {
    expect(normalizeRequestedQuantity(1)).toBe(1);
    expect(normalizeRequestedQuantity(4)).toBe(4);
    expect(normalizeRequestedQuantity("1")).toBe(1);
    expect(normalizeRequestedQuantity("10")).toBe(10);
    expect(normalizeRequestedQuantity("250")).toBe(250);
  });

  it.each([["1e21"], ["9007199254740993"], ["99999999999999999999"]])(
    "[BR-C2] keeps the huge whole number %s",
    (v) => {
      expect(normalizeRequestedQuantity(v)).toBeGreaterThan(1e15);
      expect(normalizeRequestedQuantity(Number(v))).toBe(Number(v));
    },
  );

  it("[BR-C2] turns anything else into 1", () => {
    for (const v of [
      0,
      -1,
      0.5,
      1.5,
      NaN,
      Infinity,
      -Infinity,
      "",
      " ",
      "Infinity",
      "NaN",
      null,
      true,
      false,
      {},
      [],
      [3],
      Symbol("3"),
      BigInt(10),
    ]) {
      expect(normalizeRequestedQuantity(v)).toBe(1);
    }
  });
});

describe("addLine", () => {
  it("[BR-C1] adds a new line", () => {
    const result = addLine([], lavender, 1);

    expect(result.outcome).toBe("added");
    expect(result.cap).toBe(10);
    expect(result.lines).toEqual([
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 1,
        unitPriceCents: 1800,
      },
    ]);
  });

  it("[BR-C1] appends after existing lines of other products", () => {
    const other = line({ productId: 9, slug: "cedar-hearth" });

    const result = addLine([other], lavender, 2);

    expect(result.lines).toEqual([
      other,
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 2,
        unitPriceCents: 1800,
      },
    ]);
  });

  it("[BR-C1] merges a repeated add and takes the current price", () => {
    const result = addLine(
      [line({ quantity: 2, unitPriceCents: 1800 })],
      { ...lavender, priceCents: 1900 },
      3,
    );

    expect(result.outcome).toBe("added");
    expect(result.lines).toEqual([
      {
        productId: 7,
        slug: "lavender-dusk",
        quantity: 5,
        unitPriceCents: 1900,
      },
    ]);
  });

  it("[BR-C1] keeps the position of a merged line", () => {
    const first = line();
    const second = line({ productId: 9, slug: "cedar-hearth" });

    const result = addLine([first, second], lavender, 1);

    expect(result.lines.map((l) => l.productId)).toEqual([7, 9]);
    expect(result.lines[1]).toEqual(second);
  });

  it("[BR-C1] does not mutate its input", () => {
    const original = [line()];
    const snapshot = structuredClone(original);

    addLine(original, lavender, 3);

    expect(original).toEqual(snapshot);
  });

  it("[BR-C2] caps at 10 and at stock", () => {
    const tenCap = addLine([], lavender, 12);
    expect(tenCap.outcome).toBe("clamped");
    expect(tenCap.cap).toBe(10);
    expect(tenCap.lines[0]?.quantity).toBe(10);

    const stockCap = addLine(
      [line({ quantity: 3 })],
      { ...lavender, stock: 3 },
      1,
    );
    expect(stockCap.outcome).toBe("clamped");
    expect(stockCap.cap).toBe(3);
    expect(stockCap.lines[0]?.quantity).toBe(3);
  });

  it("[BR-C2] is not clamped when the total lands exactly on the cap", () => {
    const atTen = addLine([line({ quantity: 7 })], lavender, 3);
    expect(atTen.outcome).toBe("added");
    expect(atTen.lines[0]?.quantity).toBe(10);

    const atStock = addLine(
      [line({ quantity: 1 })],
      { ...lavender, stock: 4 },
      3,
    );
    expect(atStock.outcome).toBe("added");
    expect(atStock.lines[0]?.quantity).toBe(4);
  });

  it("[BR-C2] is clamped one past the cap", () => {
    const result = addLine([line({ quantity: 7 })], lavender, 4);

    expect(result.outcome).toBe("clamped");
    expect(result.lines[0]?.quantity).toBe(10);
  });

  it("[BR-C2] pulls an existing line down to a smaller stock", () => {
    const result = addLine(
      [line({ quantity: 6 })],
      { ...lavender, stock: 4 },
      1,
    );

    expect(result.outcome).toBe("clamped");
    expect(result.cap).toBe(4);
    expect(result.lines[0]?.quantity).toBe(4);
  });

  it("[BR-C2] treats an invalid requested quantity as 1", () => {
    for (const requested of [0, -3, 1.5, NaN]) {
      const result = addLine([], lavender, requested);
      expect(result.lines[0]?.quantity).toBe(1);
      expect(result.outcome).toBe("added");
    }
  });

  it.each([["1e21"], ["9007199254740993"], ["99999999999999999999"]])(
    "[BR-C2] clamps the huge quantity %s to the cap",
    (huge) => {
      const result = addLine([], lavender, Number(huge));

      expect(result.outcome).toBe("clamped");
      expect(result.cap).toBe(10);
      expect(result.lines[0]?.quantity).toBe(10);
    },
  );

  it("[BR-C2] never creates a line for a product without stock", () => {
    const fresh = addLine([], { ...lavender, stock: 0 }, 1);
    expect(fresh.lines).toEqual([]);
    expect(fresh.outcome).toBe("clamped");
    expect(fresh.cap).toBe(0);

    const existing = addLine([line()], { ...lavender, stock: 0 }, 1);
    expect(existing.lines).toEqual([]);
    expect(existing.cap).toBe(0);
  });

  it("[BR-C2] leaves other lines untouched when removing an unstocked one", () => {
    const other = line({ productId: 9, slug: "cedar-hearth" });

    const result = addLine([other, line()], { ...lavender, stock: 0 }, 1);

    expect(result.lines).toEqual([other]);
  });
});

describe("setLineQuantity", () => {
  it("[BR-C2] [BR-C3] clamps to 1 and cap", () => {
    const clamped = setLineQuantity([line()], 7, 15, 25);
    expect(clamped.outcome).toBe("clamped");
    expect(clamped.cap).toBe(10);
    expect(clamped.lines[0]?.quantity).toBe(10);

    const floored = setLineQuantity([line()], 7, 0, 25);
    expect(floored.outcome).toBe("updated");
    expect(floored.lines[0]?.quantity).toBe(1);

    const unknown = setLineQuantity([line()], 99, 5, 25);
    expect(unknown.outcome).toBe("updated");
    expect(unknown.lines).toEqual([line()]);
  });

  it("[BR-C3] sets the quantity exactly", () => {
    const result = setLineQuantity([line({ quantity: 2 })], 7, 6, 25);

    expect(result.outcome).toBe("updated");
    expect(result.cap).toBe(10);
    expect(result.lines[0]?.quantity).toBe(6);
  });

  it("[BR-C2] is not clamped at exactly the cap", () => {
    const atTen = setLineQuantity([line()], 7, 10, 25);
    expect(atTen.outcome).toBe("updated");
    expect(atTen.lines[0]?.quantity).toBe(10);

    const atStock = setLineQuantity([line()], 7, 4, 4);
    expect(atStock.outcome).toBe("updated");
    expect(atStock.lines[0]?.quantity).toBe(4);
  });

  it("[BR-C2] clamps to stock below 10", () => {
    const result = setLineQuantity([line()], 7, 5, 4);

    expect(result.outcome).toBe("clamped");
    expect(result.cap).toBe(4);
    expect(result.lines[0]?.quantity).toBe(4);
  });

  it.each([["1e21"], ["9007199254740993"], ["99999999999999999999"]])(
    "[BR-C2] [BR-C3] clamps the huge quantity %s to the cap",
    (huge) => {
      const result = setLineQuantity([line()], 7, Number(huge), 25);

      expect(result.outcome).toBe("clamped");
      expect(result.cap).toBe(10);
      expect(result.lines[0]?.quantity).toBe(10);
    },
  );

  it("[BR-C3] leaves the lines unchanged and updated for an absent product", () => {
    const lines = [line()];

    for (const [requested, stock] of [
      [5, 25],
      [15, 25],
      [9, 4],
    ] as const) {
      const result = setLineQuantity(lines, 99, requested, stock);
      expect(result.lines).toEqual(lines);
      expect(result.outcome).toBe("updated");
    }
  });

  it("[BR-C3] treats non integers as 1", () => {
    for (const requested of [-4, 2.5, NaN, Infinity]) {
      const result = setLineQuantity([line({ quantity: 5 })], 7, requested, 25);
      expect(result.lines[0]?.quantity).toBe(1);
      expect(result.outcome).toBe("updated");
    }
  });

  it("[BR-C3] only changes the matching line and keeps the price", () => {
    const other = line({ productId: 9, slug: "cedar-hearth", quantity: 4 });
    const target = line({ unitPriceCents: 1234 });

    const result = setLineQuantity([other, target], 7, 3, 25);

    expect(result.lines).toEqual([other, { ...target, quantity: 3 }]);
  });

  it("[BR-C3] removes the line when the product has no stock", () => {
    const other = line({ productId: 9, slug: "cedar-hearth" });

    const result = setLineQuantity([other, line()], 7, 3, 0);

    expect(result.lines).toEqual([other]);
    expect(result.outcome).toBe("clamped");
    expect(result.cap).toBe(0);
  });

  it("[BR-C3] does not mutate its input", () => {
    const original = [line()];
    const snapshot = structuredClone(original);

    setLineQuantity(original, 7, 9, 25);

    expect(original).toEqual(snapshot);
  });
});

describe("removeLine", () => {
  it("[BR-C3] removes a line", () => {
    const other = line({ productId: 9, slug: "cedar-hearth" });

    expect(removeLine([line(), other], 7)).toEqual([other]);
    expect(removeLine([line()], 7)).toEqual([]);
  });

  it("[BR-C3] ignores an unknown product", () => {
    expect(removeLine([line()], 99)).toEqual([line()]);
    expect(removeLine([], 7)).toEqual([]);
  });
});

describe("cartCount", () => {
  it("[BR-C4] counts total quantity", () => {
    expect(cartCount([])).toBe(0);
    expect(cartCount([line({ quantity: 2 })])).toBe(2);
    expect(
      cartCount([
        line({ quantity: 2 }),
        line({ productId: 9, quantity: 10 }),
        line({ productId: 11, quantity: 1 }),
      ]),
    ).toBe(13);
  });
});

describe("applyStockLimits", () => {
  it("[BR-K4] applies stock limits", () => {
    const other = line({ productId: 9, slug: "cedar-hearth", quantity: 3 });
    const gone = line({ productId: 11, slug: "sage-smoke", quantity: 2 });

    const result = applyStockLimits(
      [line({ quantity: 5 }), other, gone],
      [
        { productId: 7, available: 1 },
        { productId: 11, available: 0 },
      ],
    );

    expect(result).toEqual([line({ quantity: 1 }), other]);
  });

  it("[BR-K4] never raises a quantity", () => {
    expect(
      applyStockLimits(
        [line({ quantity: 2 })],
        [{ productId: 7, available: 8 }],
      ),
    ).toEqual([line({ quantity: 2 })]);
    expect(
      applyStockLimits(
        [line({ quantity: 2 })],
        [{ productId: 7, available: 2 }],
      ),
    ).toEqual([line({ quantity: 2 })]);
  });

  it("[BR-K4] also respects the per line maximum", () => {
    expect(
      applyStockLimits(
        [line({ quantity: 10 })],
        [{ productId: 7, available: 40 }],
      ),
    ).toEqual([line({ quantity: 10 })]);
  });

  it("[BR-K4] removes a line with negative availability", () => {
    expect(
      applyStockLimits([line()], [{ productId: 7, available: -1 }]),
    ).toEqual([]);
  });

  it("[BR-K4] leaves lines without a report alone", () => {
    expect(applyStockLimits([line()], [])).toEqual([line()]);
    expect(
      applyStockLimits([line()], [{ productId: 99, available: 0 }]),
    ).toEqual([line()]);
  });

  it("[BR-K4] does not mutate its input", () => {
    const original = [line({ quantity: 5 })];
    const snapshot = structuredClone(original);

    applyStockLimits(original, [{ productId: 7, available: 1 }]);

    expect(original).toEqual(snapshot);
  });
});

describe("applyPriceChanges", () => {
  it("[BR-K4] applies price changes", () => {
    const other = line({
      productId: 9,
      slug: "cedar-hearth",
      unitPriceCents: 500,
    });

    const result = applyPriceChanges(
      [line({ unitPriceCents: 1800 }), other],
      [{ productId: 7, unitPriceCents: 1900 }],
    );

    expect(result).toEqual([line({ unitPriceCents: 1900 }), other]);
  });

  it("[BR-K4] leaves lines without a report alone", () => {
    expect(applyPriceChanges([line()], [])).toEqual([line()]);
    expect(
      applyPriceChanges([line()], [{ productId: 99, unitPriceCents: 1 }]),
    ).toEqual([line()]);
  });

  it("[BR-K4] keeps the quantity", () => {
    expect(
      applyPriceChanges(
        [line({ quantity: 6 })],
        [{ productId: 7, unitPriceCents: 10 }],
      ),
    ).toEqual([line({ quantity: 6, unitPriceCents: 10 })]);
  });

  it("[BR-K4] does not mutate its input", () => {
    const original = [line()];
    const snapshot = structuredClone(original);

    applyPriceChanges(original, [{ productId: 7, unitPriceCents: 1 }]);

    expect(original).toEqual(snapshot);
  });
});
