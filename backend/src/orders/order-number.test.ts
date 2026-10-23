import { describe, expect, it } from "vitest";
import { generateOrderNumber } from "./order-number.js";

describe("generateOrderNumber", () => {
  it("generates order numbers from random bytes", () => {
    expect(generateOrderNumber(() => Buffer.from([0, 1, 2, 35, 36, 71]))).toBe(
      "WC-ABC9A9",
    );
  });

  it("asks for six bytes", () => {
    let asked = -1;
    generateOrderNumber((size) => {
      asked = size;
      return Buffer.alloc(size);
    });
    expect(asked).toBe(6);
  });

  it("maps the highest byte through the modulo", () => {
    expect(generateOrderNumber(() => Buffer.from(Array(6).fill(255)))).toBe(
      "WC-DDDDDD",
    );
  });

  it("generates well formed order numbers", () => {
    expect(generateOrderNumber()).toMatch(/^WC-[A-Z0-9]{6}$/);
  });

  it("generates different order numbers", () => {
    const seen = new Set(
      Array.from({ length: 20 }, () => generateOrderNumber()),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});
