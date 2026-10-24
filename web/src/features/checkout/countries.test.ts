import { describe, expect, it } from "vitest";
import { COUNTRIES, countryName } from "./countries";

describe("countries", () => {
  it("[BR-K2] lists the five countries in contract order", () => {
    expect(COUNTRIES).toEqual([
      { code: "US", name: "United States" },
      { code: "CA", name: "Canada" },
      { code: "GB", name: "United Kingdom" },
      { code: "DE", name: "Germany" },
      { code: "NL", name: "Netherlands" },
    ]);
  });

  it.each([
    ["US", "United States"],
    ["CA", "Canada"],
    ["GB", "United Kingdom"],
    ["DE", "Germany"],
    ["NL", "Netherlands"],
  ])("[BR-K2] names %s as %s", (code, name) => {
    expect(countryName(code)).toBe(name);
  });

  it.each(["FR", "", "gb", " GB", "toString", "constructor"])(
    "[BR-K2] returns the code itself for unknown code %j",
    (code) => {
      expect(countryName(code)).toBe(code);
    },
  );
});
