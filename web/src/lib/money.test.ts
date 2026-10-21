import { describe, expect, it } from "vitest";
import { formatShipping, formatUsd } from "./money";

describe("formatUsd", () => {
  it.each([
    [1615, "$16.15"],
    [0, "$0.00"],
    [1, "$0.01"],
    [99, "$0.99"],
    [100, "$1.00"],
    [123456, "$1,234.56"],
    [123456789, "$1,234,567.89"],
    [-150, "-$1.50"],
  ])("formats %i cents as %s", (cents, expected) => {
    expect(formatUsd(cents)).toBe(expected);
  });

  it.each([
    ["a fraction", 10.5],
    ["a tiny fraction", 0.1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["negative Infinity", Number.NEGATIVE_INFINITY],
    ["an unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("throws a RangeError for %s", (_label, cents) => {
    expect(() => formatUsd(cents)).toThrow(RangeError);
  });

  it("names the offending value in the error", () => {
    expect(() => formatUsd(10.5)).toThrow(/10\.5/);
  });
});

describe("formatShipping", () => {
  it("[BR-C5] shows Free for zero shipping", () => {
    expect(formatShipping(0)).toBe("Free");
    expect(formatShipping(595)).toBe("$5.95");
  });

  it("formats one cent as money, not Free", () => {
    expect(formatShipping(1)).toBe("$0.01");
  });

  it("rejects fractional shipping", () => {
    expect(() => formatShipping(0.5)).toThrow(RangeError);
  });
});
