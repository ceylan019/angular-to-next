import { describe, expect, it } from "vitest";
import { stockStatus } from "./stock-status";

describe("stockStatus", () => {
  it.each([
    [0, "Out of stock"],
    [1, "Only 1 left"],
    [3, "Only 3 left"],
    [4, "In stock"],
  ])("[BR-B1] stock %i reads %s", (stock, text) => {
    expect(stockStatus(stock)).toBe(text);
  });

  it.each([
    [2, "Only 2 left"],
    [10, "In stock"],
    [1000, "In stock"],
  ])("[BR-B1] stock %i also reads %s", (stock, text) => {
    expect(stockStatus(stock)).toBe(text);
  });

  it("[BR-B8] a negative stock reads Out of stock", () => {
    expect(stockStatus(-1)).toBe("Out of stock");
  });
});
