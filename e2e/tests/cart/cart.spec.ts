import type { Page } from "@playwright/test";
import { setProduct } from "../../support/backend.js";
import { bySlug } from "../../support/catalog.js";
import { addFromDetail, addFromList, cartBadge } from "../../support/cart.js";
import { COPY } from "../../support/copy.js";
import { expectEmptyCart } from "../../support/expectations.js";
import { expect, test } from "../../support/fixtures.js";
import { byTarget } from "../../support/known-differences.js";
import { usd } from "../../support/money.js";

const CAP = 10;

function cartRow(page: Page, name: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
}

function quantityInput(page: Page, name: string) {
  return page.getByRole("spinbutton", { name: COPY.cart.quantityFor(name) });
}

async function expectBadge(page: Page, count: number): Promise<void> {
  await expect(cartBadge(page)).toHaveAccessibleName(COPY.header.cart(count));
  await expect(cartBadge(page)).toHaveAttribute("href", "/cart");
}

test.describe("cart @cart", () => {
  test("[BR-C1] adds from the list and the detail page, merging lines", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");

    await addFromList(page, product.name);

    await expect(page.getByRole("status")).toHaveText(
      COPY.cart.added(product.name),
    );
    await expectBadge(page, 1);

    await addFromDetail(page, product.slug, 2);

    await expect(page.getByRole("status")).toHaveText(
      COPY.cart.added(product.name),
    );
    await expectBadge(page, 3);

    await page.goto("/cart");

    await expect(page).toHaveTitle(COPY.title.cart);
    await expect(
      page.getByRole("heading", { level: 1, name: COPY.cart.heading }),
    ).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(quantityInput(page, product.name)).toHaveValue("3");
    await expect(
      cartRow(page, product.name).getByRole("link", {
        name: product.name,
        exact: true,
      }),
    ).toHaveAttribute("href", `/products/${product.slug}`);
    await expect(
      cartRow(page, product.name).getByText(usd(product.priceCents), {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      cartRow(page, product.name).getByText(usd(product.priceCents * 3), {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("[BR-C1] the cart table has its column headers and a checkout link", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");
    await addFromList(page, product.name);

    await page.goto("/cart");

    await expect(page.getByRole("columnheader")).toHaveText(COPY.cart.columns);
    await expect(
      cartRow(page, product.name).getByRole("button", {
        name: COPY.cart.removeItem(product.name),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: COPY.cart.checkout, exact: true }),
    ).toHaveAttribute("href", "/checkout");
  });

  test("[BR-C1] different candles get their own lines", async ({ page }) => {
    const first = bySlug("lavender-dusk");
    const second = bySlug("orange-grove");
    await addFromDetail(page, first.slug, 1);
    await addFromDetail(page, second.slug, 2);

    await page.goto("/cart");

    await expect(page.getByRole("row")).toHaveCount(3);
    await expect(quantityInput(page, first.name)).toHaveValue("1");
    await expect(quantityInput(page, second.name)).toHaveValue("2");
    await expectBadge(page, 3);
  });

  test("[BR-C2] caps a line at 10", async ({ page }) => {
    const product = bySlug("lavender-dusk");

    await addFromDetail(page, product.slug, 12);

    await expect(page.getByRole("status")).toHaveText(
      COPY.cart.cap(CAP, product.name),
    );
    await expectBadge(page, CAP);

    await page.goto("/cart");

    await expect(quantityInput(page, product.name)).toHaveValue(String(CAP));
  });

  test("[BR-C2] adding to a full line keeps it at 10 and shows the cap message", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");
    await addFromDetail(page, product.slug, CAP);

    await addFromList(page, product.name);

    await expect(page.getByRole("status")).toHaveText(
      COPY.cart.cap(CAP, product.name),
    );
    await expectBadge(page, CAP);
  });

  test("[BR-C2] caps a line at stock", async ({ page }) => {
    const product = bySlug("ember-clove");

    await addFromDetail(page, product.slug, 2);
    await expectBadge(page, 2);
    await addFromDetail(page, product.slug, 2);

    await expect(page.getByRole("status")).toHaveText(
      COPY.cart.cap(product.stock, product.name),
    );
    await expectBadge(page, product.stock);
  });

  test("[BR-C2] a request of exactly the cap adds without the cap message", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");

    await addFromDetail(page, product.slug, CAP);

    await expect(page.getByRole("status")).toHaveText(
      COPY.cart.added(product.name),
    );
    await expectBadge(page, CAP);
  });

  test("[BR-C2] the cart quantity input clamps above the cap", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");
    await addFromList(page, product.name);
    await page.goto("/cart");
    const quantity = quantityInput(page, product.name);

    await quantity.fill("15");
    await quantity.blur();

    await expect(quantity).toHaveValue(String(CAP));
    await expect(page.getByRole("status")).toHaveText(
      COPY.cart.cap(CAP, product.name),
    );
    await expectBadge(page, CAP);
  });

  test("[BR-C2] the cart quantity input clamps to stock", async ({ page }) => {
    const product = bySlug("ember-clove");
    await addFromList(page, product.name);
    await page.goto("/cart");
    const quantity = quantityInput(page, product.name);

    await quantity.fill("9");
    await quantity.blur();

    await expect(quantity).toHaveValue(String(product.stock));
    await expect(page.getByRole("status")).toHaveText(
      COPY.cart.cap(product.stock, product.name),
    );
    await expectBadge(page, product.stock);
  });

  test("[BR-C2] [KD-06] the cart caps edits by current stock", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");
    const stock = 3;
    await addFromDetail(page, product.slug, 2);
    await setProduct(page.request, product.slug, { stock });
    await page.goto("/cart");
    const quantity = quantityInput(page, product.name);

    await quantity.fill("5");
    await quantity.blur();

    await expectBadge(page, byTarget("KD-06", { legacy: 5, next: stock }));
    await expect(quantity).toHaveValue(
      byTarget("KD-06", { legacy: "5", next: String(stock) }),
    );
    await expect(page.getByRole("status")).toHaveText(
      byTarget("KD-06", {
        legacy: "",
        next: COPY.cart.cap(stock, product.name),
      }),
    );
  });

  test("[BR-C3] a cart quantity change updates the line total and the badge", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");
    await addFromList(page, product.name);
    await page.goto("/cart");
    const quantity = quantityInput(page, product.name);

    await quantity.fill("4");
    await quantity.blur();

    await expect(quantity).toHaveValue("4");
    await expect(
      cartRow(page, product.name).getByText(usd(product.priceCents * 4), {
        exact: true,
      }),
    ).toBeVisible();
    await expectBadge(page, 4);
  });

  for (const value of ["0", "-3", "", "2.5"]) {
    test(`[BR-C3] quantity cannot go below 1: "${value}" becomes 1`, async ({
      page,
    }) => {
      const product = bySlug("lavender-dusk");
      await addFromDetail(page, product.slug, 3);
      await page.goto("/cart");
      const quantity = quantityInput(page, product.name);

      await quantity.fill(value);
      await quantity.blur();

      await expect(quantity).toHaveValue("1");
      await expectBadge(page, 1);
    });
  }

  test("[BR-C3] Remove deletes the line and the last removal shows the empty state", async ({
    page,
  }) => {
    const kept = bySlug("orange-grove");
    const removed = bySlug("lavender-dusk");
    await addFromDetail(page, removed.slug, 2);
    await addFromDetail(page, kept.slug, 1);
    await page.goto("/cart");

    await page
      .getByRole("button", { name: COPY.cart.removeItem(removed.name) })
      .click();

    await expect(cartRow(page, removed.name)).toHaveCount(0);
    await expect(quantityInput(page, kept.name)).toHaveValue("1");
    await expectBadge(page, 1);

    await page
      .getByRole("button", { name: COPY.cart.removeItem(kept.name) })
      .click();

    await expectEmptyCart(page);
    await expectBadge(page, 0);
  });

  test("[BR-C4] the badge shows total quantity on every page", async ({
    page,
  }) => {
    const first = bySlug("lavender-dusk");
    const second = bySlug("orange-grove");
    await addFromDetail(page, first.slug, 2);
    await addFromDetail(page, second.slug, 1);

    for (const path of [
      "/",
      `/products/${first.slug}`,
      "/cart",
      "/checkout",
      "/no/such/page",
    ]) {
      await page.goto(path);

      await expectBadge(page, 3);
    }
  });

  test("[BR-C4] [KD-04] the server rendered badge", async ({
    page,
    noJsPage,
  }) => {
    const product = bySlug("lavender-dusk");
    await addFromDetail(page, product.slug, 2);
    await expectBadge(page, 2);

    const serverRendered = await noJsPage({
      storageState: await page.context().storageState(),
    });
    await serverRendered.goto("/");

    await expect(cartBadge(serverRendered)).toHaveAccessibleName(
      byTarget("KD-04", {
        legacy: COPY.header.cart(0),
        next: COPY.header.cart(2),
      }),
    );
  });

  test("[BR-C6] the cart survives reload and navigation", async ({ page }) => {
    const product = bySlug("lavender-dusk");
    await addFromDetail(page, product.slug, 2);
    await expectBadge(page, 2);

    await page.reload();
    await expectBadge(page, 2);

    await page.goto("/");
    await expectBadge(page, 2);

    await page.goto("/cart");
    await expect(quantityInput(page, product.name)).toHaveValue("2");

    await page.goBack();
    await expectBadge(page, 2);
  });

  test("[BR-C6] a second tab of the same browser sees the cart", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");
    await addFromDetail(page, product.slug, 2);
    await expectBadge(page, 2);

    const other = await page.context().newPage();
    await other.goto("/cart");

    await expect(quantityInput(other, product.name)).toHaveValue("2");
    await expectBadge(other, 2);
  });

  test("[BR-C6] another browser starts with an empty cart", async ({
    page,
    browser,
    baseURL,
  }) => {
    await addFromDetail(page, bySlug("lavender-dusk").slug, 2);

    const context = await browser.newContext({
      baseURL,
      viewport: test.info().project.use.viewport,
    });
    try {
      const stranger = await context.newPage();
      await stranger.goto("/cart");

      await expectEmptyCart(stranger);
      await expectBadge(stranger, 0);
    } finally {
      await context.close();
    }
  });

  test("[BR-C7] the empty cart shows its state and no checkout link", async ({
    page,
  }) => {
    await page.goto("/cart");

    await expect(
      page.getByRole("heading", { level: 1, name: COPY.cart.heading }),
    ).toBeVisible();
    await expectEmptyCart(page);
    await expectBadge(page, 0);
  });
});
