import type { Locator } from "@playwright/test";
import { addFromDetail } from "../../support/cart.js";
import { COPY } from "../../support/copy.js";
import { expect, test } from "../../support/fixtures.js";

const HEADER = `
  - banner:
    - link "${COPY.brand}":
      - /url: /
    - navigation "${COPY.header.nav}"
`;

const SHOP = `
  - link "${COPY.header.shop}":
    - /url: /
`;

const CART = `
  - link /Cart \\(\\d+\\)/:
    - /url: /cart
`;

function navLinks(banner: Locator) {
  return banner
    .getByRole("navigation", { name: COPY.header.nav })
    .getByRole("link");
}

test.describe("shell structure @shell", () => {
  for (const path of ["/", "/cart", "/checkout", "/products/lavender-dusk"]) {
    test(`[BR-C4] header structure on ${path}`, async ({ page }) => {
      if (path === "/checkout") {
        await addFromDetail(page, "lavender-dusk", 1);
      }
      await page.goto(path);
      const banner = page.getByRole("banner");

      await expect(banner).toMatchAriaSnapshot(HEADER);
      await expect(navLinks(banner)).toHaveCount(2);
      await expect(navLinks(banner).first()).toMatchAriaSnapshot(SHOP);
      await expect(navLinks(banner).last()).toMatchAriaSnapshot(CART);
    });
  }
});
