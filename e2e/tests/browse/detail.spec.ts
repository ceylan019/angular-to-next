import { bySlug } from "../../support/catalog.js";
import { COPY } from "../../support/copy.js";
import { expectNotFound } from "../../support/expectations.js";
import { expect, test } from "../../support/fixtures.js";
import { byTarget } from "../../support/known-differences.js";
import { usd } from "../../support/money.js";

const CAP = 10;

test.describe("product detail @browse", () => {
  test("[BR-B6] product page shows details and the quantity picker", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");

    await page.goto(`/products/${product.slug}`);

    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { level: 1, name: product.name }),
    ).toBeVisible();
    await expect(
      main.getByText(usd(product.priceCents), { exact: true }),
    ).toBeVisible();
    await expect(
      main.getByText(COPY.stock(product.stock), { exact: true }),
    ).toBeVisible();
    await expect(
      main.getByText(product.description, { exact: true }),
    ).toBeVisible();
    await expect(
      main.getByText(COPY.product.scentNotes(product.scentNotes), {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      main.getByText(COPY.product.burnTime(product.burnTimeHours), {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      main.getByText(COPY.product.size(product.sizeOz), { exact: true }),
    ).toBeVisible();

    const quantity = main.getByRole("spinbutton", {
      name: COPY.product.quantity,
    });
    await expect(quantity).toHaveValue("1");
    await expect(quantity).toHaveAttribute("min", "1");
    await expect(quantity).toHaveAttribute("max", String(CAP));
    await expect(quantity).toBeEnabled();
    await expect(
      main.getByRole("button", { name: COPY.addToCart }),
    ).toBeEnabled();
    await expect(page).toHaveTitle(COPY.title.product(product.name));
  });

  test("[BR-B6] the quantity maximum is the stock when stock is below 10", async ({
    page,
  }) => {
    const product = bySlug("ember-clove");

    await page.goto(`/products/${product.slug}`);

    await expect(
      page.getByText(COPY.stock(product.stock), { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("spinbutton", { name: COPY.product.quantity }),
    ).toHaveAttribute("max", String(product.stock));
  });

  test("[BR-B6] the quantity maximum is 1 when one candle is left", async ({
    page,
  }) => {
    const product = bySlug("last-light");

    await page.goto(`/products/${product.slug}`);

    await expect(
      page.getByText(COPY.stock(product.stock), { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("spinbutton", { name: COPY.product.quantity }),
    ).toHaveAttribute("max", "1");
  });

  test("[BR-C1] the quantity keeps the typed value after adding", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");
    await page.goto(`/products/${product.slug}`);
    const quantity = page.getByRole("spinbutton", {
      name: COPY.product.quantity,
    });
    const addToCart = page.getByRole("button", { name: COPY.addToCart });

    await quantity.fill("2");
    await addToCart.click();

    await expect(page.getByRole("status")).toHaveText(
      COPY.cart.added(product.name),
    );
    await expect(quantity).toHaveValue("2");

    await quantity.fill("12");
    await addToCart.click();

    await expect(page.getByRole("status")).toHaveText(
      COPY.cart.cap(CAP, product.name),
    );
    await expect(quantity).toHaveValue("12");
  });

  test("[BR-B6] the product page links back to the shop through the header", async ({
    page,
  }) => {
    await page.goto("/products/lavender-dusk");

    await page
      .getByRole("banner")
      .getByRole("link", { name: COPY.header.shop, exact: true })
      .click();

    await expect(page).toHaveURL("/");
  });

  test("[BR-B6] opening a product from the list shows its page", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");
    await page.goto("/?family=floral");

    await page
      .getByRole("list", { name: COPY.list.products })
      .getByRole("link", { name: product.name, exact: true })
      .click();

    await expect(page).toHaveURL(`/products/${product.slug}`);
    await expect(
      page.getByRole("heading", { level: 1, name: product.name }),
    ).toBeVisible();
  });

  test("[BR-B8] an out of stock candle cannot be added from the list or the detail page", async ({
    page,
  }) => {
    const product = bySlug("midnight-jasmine");
    await page.goto("/?family=floral");

    const card = page
      .getByRole("list", { name: COPY.list.products })
      .getByRole("listitem")
      .filter({
        has: page.getByRole("heading", { name: product.name, exact: true }),
      });
    await expect(
      card.getByText(COPY.stock(product.stock), { exact: true }),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: COPY.addToCart }),
    ).toBeDisabled();

    await page.goto(`/products/${product.slug}`);

    await expect(
      page.getByText(COPY.stock(product.stock), { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: COPY.addToCart }),
    ).toBeDisabled();
    await expect(
      page.getByRole("spinbutton", { name: COPY.product.quantity }),
    ).toBeDisabled();
  });

  test("[BR-B7] [KD-02] an unknown product shows not found", async ({
    page,
  }) => {
    const response = await page.goto("/products/no-such-candle");

    expect(response?.status()).toBe(
      byTarget("KD-02", { legacy: 200, next: 404 }),
    );
    await expectNotFound(page);
  });

  test("[KD-02] an unknown route shows not found", async ({ page }) => {
    const response = await page.goto("/no/such/page");

    expect(response?.status()).toBe(
      byTarget("KD-02", { legacy: 200, next: 404 }),
    );
    await expectNotFound(page);
  });

  test("[BR-B7] the not found link returns to the shop", async ({ page }) => {
    await page.goto("/products/no-such-candle");

    await page.getByRole("link", { name: COPY.notFound.backToShop }).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1, name: COPY.list.heading }),
    ).toBeVisible();
  });
});
