import { describe, expect, it } from "vitest";
import {
  isExpired,
  isLuhnValid,
  normalizeCardNumber,
  parseExpiry,
} from "./card";

describe("card rules", () => {
  it.each([
    ["4242424242424242", true],
    ["4000000000000002", true],
    ["5555555555554444", true],
    ["4242424242424241", false],
    ["", false],
    ["42424242424242a2", false],
    ["0000000000000000", true],
    ["79927398713", true],
    ["79927398710", false],
    [" 0", false],
    ["00 ", false],
    ["0", true],
    ["18", true],
    ["59", true],
    ["42424242424242426", true],
    ["4111111111111111", true],
    ["4111111111111112", false],
    ["4242424242424242\n", false],
    ["٤٢٤٢٤٢٤٢٤٢٤٢٤٢٤٢", false],
  ])("[BR-K3] luhn %j is %s", (digits, ok) => {
    expect(isLuhnValid(digits)).toBe(ok);
  });

  it("[BR-K3] removes spaces from card numbers", () => {
    expect(normalizeCardNumber("4242 4242 4242 4242")).toBe("4242424242424242");
  });

  it("[BR-K3] removes spaces only", () => {
    expect(normalizeCardNumber("  4242  42-42 ")).toBe("424242-42");
    expect(normalizeCardNumber("42\t42")).toBe("42\t42");
    expect(normalizeCardNumber("")).toBe("");
  });

  it("[BR-K3] parses MM/YY into years 2000 to 2099", () => {
    expect(parseExpiry("12/40")).toEqual({ month: 12, year: 2040 });
    expect(parseExpiry("01/00")).toEqual({ month: 1, year: 2000 });
    expect(parseExpiry("09/26")).toEqual({ month: 9, year: 2026 });
    expect(parseExpiry("10/99")).toEqual({ month: 10, year: 2099 });
  });

  it.each([
    "1/40",
    "13/40",
    "00/40",
    "12/4",
    "12-40",
    " 12/40",
    "12/40 ",
    "12/400",
    "012/40",
    "",
    "ab/cd",
    "12/4a",
    "12/40\n",
    "١٢/٤٠",
  ])("[BR-K3] rejects expiry %j", (value) => {
    expect(parseExpiry(value)).toBeNull();
  });

  it("[BR-K3] a card is valid through the last moment of its month", () => {
    const expiry = { month: 10, year: 2026 };
    expect(isExpired(expiry, new Date("2026-10-31T23:59:59.999Z"))).toBe(false);
    expect(isExpired(expiry, new Date("2026-11-01T00:00:00.000Z"))).toBe(true);
  });

  it("[BR-K3] handles the December boundary", () => {
    const expiry = { month: 12, year: 2026 };
    expect(isExpired(expiry, new Date("2026-12-31T23:59:59.999Z"))).toBe(false);
    expect(isExpired(expiry, new Date("2027-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("[BR-K3] handles the end of a leap February", () => {
    const expiry = { month: 2, year: 2028 };
    expect(isExpired(expiry, new Date("2028-02-29T23:59:59.999Z"))).toBe(false);
    expect(isExpired(expiry, new Date("2028-03-01T00:00:00.000Z"))).toBe(true);
  });

  it("[BR-K3] compares the month and the year", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    expect(isExpired({ month: 10, year: 2026 }, now)).toBe(false);
    expect(isExpired({ month: 9, year: 2026 }, now)).toBe(true);
    expect(isExpired({ month: 11, year: 2026 }, now)).toBe(false);
    expect(isExpired({ month: 1, year: 2027 }, now)).toBe(false);
    expect(isExpired({ month: 12, year: 2025 }, now)).toBe(true);
    expect(isExpired({ month: 1, year: 2020 }, now)).toBe(true);
  });
});
