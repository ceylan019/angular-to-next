import { describe, expect, it } from "vitest";
import { ENABLED_NEXT_FLOWS, flowGrep } from "./flows.js";

const TITLES = [
  "next tests/shell/header.spec.ts header @shell shows the brand",
  "next tests/browse/list.spec.ts list @browse lists candles",
  "next tests/cart/cart.spec.ts cart @cart adds a line",
  "next tests/checkout/checkout.spec.ts checkout @checkout places an order",
];

function matching(grep: RegExp): string[] {
  return TITLES.filter((title) => grep.test(title));
}

describe("flowGrep", () => {
  it("enables no flow for the next project yet", () => {
    expect(ENABLED_NEXT_FLOWS).toEqual([]);
  });

  it("matches no test at all when no flow is enabled", () => {
    const grep = flowGrep([]);

    expect(matching(grep)).toEqual([]);
    expect(grep.test("")).toBe(false);
    expect(grep.test("@")).toBe(false);
  });

  it("matches only the tests tagged with the one enabled flow", () => {
    expect(matching(flowGrep(["cart"]))).toEqual([TITLES[2]]);
  });

  it("matches every enabled flow and nothing else", () => {
    expect(matching(flowGrep(["shell", "checkout"]))).toEqual([
      TITLES[0],
      TITLES[3],
    ]);
  });

  it("matches all four flows when all are enabled", () => {
    expect(matching(flowGrep(["shell", "browse", "cart", "checkout"]))).toEqual(
      TITLES,
    );
  });

  it("needs the tag, not the folder name", () => {
    expect(flowGrep(["shell"]).test("next tests/shell/header.spec.ts")).toBe(
      false,
    );
  });

  it("does not match a longer tag that starts with an enabled flow", () => {
    expect(flowGrep(["cart"]).test("cart @cartography")).toBe(false);
  });

  it("matches a tag at the very end of a title", () => {
    expect(flowGrep(["cart"]).test("cart @cart")).toBe(true);
  });
});
