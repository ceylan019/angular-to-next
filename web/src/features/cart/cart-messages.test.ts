import { describe, expect, it } from "vitest";
import { addedMessage, capMessage } from "./cart-messages";

describe("cart messages", () => {
  it("[BR-C1] words the added message", () => {
    expect(addedMessage("Lavender Dusk")).toBe(
      "Added Lavender Dusk to your cart.",
    );
  });

  it("[BR-C2] words the cap message", () => {
    expect(capMessage(10, "Lavender Dusk")).toBe(
      "You can buy at most 10 of Lavender Dusk.",
    );
    expect(capMessage(3, "Fig & Cassis")).toBe(
      "You can buy at most 3 of Fig & Cassis.",
    );
  });

  it("[BR-C1] keeps names with unusual characters intact", () => {
    expect(addedMessage('Zoë Ångström "Noir"')).toBe(
      'Added Zoë Ångström "Noir" to your cart.',
    );
  });
});
