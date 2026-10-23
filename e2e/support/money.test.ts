import { describe, expect, it } from "vitest";
import { usd } from "./money.js";

describe("usd", () => {
  it.each([
    [0, "$0.00"],
    [5, "$0.05"],
    [50, "$0.50"],
    [595, "$5.95"],
    [1615, "$16.15"],
    [5000, "$50.00"],
    [99999, "$999.99"],
    [100000, "$1,000.00"],
    [123456, "$1,234.56"],
    [123456789, "$1,234,567.89"],
    [-595, "-$5.95"],
  ])("formats %i cents as %s", (cents, expected) => {
    expect(usd(cents)).toBe(expected);
  });

  it.each([16.15, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses %s because amounts are whole cents",
    (cents) => {
      expect(() => usd(cents)).toThrow(
        `usd expects whole cents, got ${String(cents)}`,
      );
    },
  );
});
