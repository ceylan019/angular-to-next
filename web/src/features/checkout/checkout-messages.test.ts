import { describe, expect, it } from "vitest";
import { alertMessages, outOfStockMessage } from "./checkout-messages";

describe("checkout messages", () => {
  it("[BR-K4] names the candle in the out of stock sentence", () => {
    expect(outOfStockMessage("Ember & Clove")).toBe(
      "Ember & Clove is no longer available in the quantity you chose. We updated your cart.",
    );
  });

  it("[BR-K3] shows the declined alert", () => {
    expect(alertMessages({ status: "declined" })).toEqual([
      "Your card was declined.",
    ]);
  });

  it("[BR-K4] shows the price changed alert", () => {
    expect(alertMessages({ status: "price-changed" })).toEqual([
      "Prices changed for some items. Please review your order and place it again.",
    ]);
  });

  it("[BR-K2] shows the backend validation alert", () => {
    expect(alertMessages({ status: "invalid" })).toEqual([
      "Please check your details and try again.",
    ]);
  });

  it("[BR-K4] shows one out of stock sentence per item in the given order", () => {
    const messages = [
      outOfStockMessage("Last Light"),
      outOfStockMessage("Ember & Clove"),
    ];

    expect(alertMessages({ status: "out-of-stock", messages })).toEqual(
      messages,
    );
  });

  it("[BR-K4] falls back to the backend validation alert when no item can be named", () => {
    expect(alertMessages({ status: "out-of-stock", messages: [] })).toEqual([
      "Please check your details and try again.",
    ]);
  });

  it("[BR-K4] keeps a single named item without the fallback", () => {
    expect(
      alertMessages({
        status: "out-of-stock",
        messages: [outOfStockMessage("Last Light")],
      }),
    ).toEqual([outOfStockMessage("Last Light")]);
  });
});
