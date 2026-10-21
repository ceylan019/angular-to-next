import type { Page } from "@playwright/test";
import { COPY } from "../../support/copy.js";
import { expect, test } from "../../support/fixtures.js";

async function expectHeader(page: Page, cartCount: number): Promise<void> {
  const banner = page.getByRole("banner");
  await expect(
    banner.getByRole("link", { name: COPY.brand, exact: true }),
  ).toHaveAttribute("href", "/");

  const nav = banner.getByRole("navigation", { name: COPY.header.nav });
  await expect(nav.getByRole("link")).toHaveText([
    COPY.header.shop,
    COPY.header.cart(cartCount),
  ]);
  await expect(
    nav.getByRole("link", { name: COPY.header.shop, exact: true }),
  ).toHaveAttribute("href", "/");
  await expect(
    nav.getByRole("link", { name: COPY.header.cart(cartCount), exact: true }),
  ).toHaveAttribute("href", "/cart");
}

test.describe("header @shell", () => {
  test("[BR-C4] shows brand, Shop and an empty cart on first visit", async ({
    page,
  }) => {
    await page.goto("/");

    await expectHeader(page, 0);
  });

  test("[BR-C4] renders the header on the server with an empty cart", async ({
    noJsPage,
  }) => {
    const page = await noJsPage();
    await page.goto("/");

    await expectHeader(page, 0);
  });
});
