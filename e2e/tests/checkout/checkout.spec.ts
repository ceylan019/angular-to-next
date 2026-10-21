import type { Page } from "@playwright/test";
import { cartBadge } from "../../support/cart.js";
import { bySlug } from "../../support/catalog.js";
import {
  fillCheckout,
  openCheckout,
  orderSummary,
  placeOrder,
  summaryLine,
  VALID_DETAILS,
} from "../../support/checkout.js";
import { COPY } from "../../support/copy.js";
import { orderCount, productStock, setProduct } from "../../support/backend.js";
import { expectEmptyCart, expectNotFound } from "../../support/expectations.js";
import { expect, test } from "../../support/fixtures.js";
import { byTarget } from "../../support/known-differences.js";
import { usd } from "../../support/money.js";

const ORDER_URL = /\/order\/WC-[A-Z0-9]{6}$/;
const EMAIL = COPY.checkout.labels.email;

function alertWith(page: Page, text: string) {
  return page.getByRole("alert").filter({ hasText: text });
}

async function expectConfirmation(page: Page): Promise<void> {
  await expect(page).toHaveURL(ORDER_URL);
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.confirmation.heading }),
  ).toBeVisible();
}

function orderNumberOf(page: Page): string {
  const match = /\/order\/(WC-[A-Z0-9]{6})$/.exec(page.url());
  if (match?.[1] === undefined) {
    throw new Error(`Not an order URL: ${page.url()}`);
  }
  return match[1];
}

test.describe("checkout @checkout", () => {
  test("[BR-K1] an empty cart redirects to the cart page", async ({ page }) => {
    await page.goto("/checkout");

    await expect(page).toHaveURL(/\/cart$/);
    await expect(
      page.getByRole("heading", { level: 1, name: COPY.cart.heading }),
    ).toBeVisible();
    await expectEmptyCart(page);
  });

  test("[BR-K1] the checkout page shows its form and order summary", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");

    await openCheckout(page, product.slug, 2);

    await expect(page).toHaveTitle(COPY.title.checkout);
    await expect(
      page.getByRole("group", { name: COPY.checkout.legends.contact }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: COPY.checkout.legends.shipping }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: COPY.checkout.legends.payment }),
    ).toBeVisible();
    await expect(
      page.getByLabel(COPY.checkout.labels.country, { exact: true }),
    ).toHaveValue("");
    await expect(summaryLine(page, product.name, 2)).toContainText(
      usd(product.priceCents * 2),
    );
    await expect(orderSummary(page).getByRole("term")).toHaveText([
      COPY.totals.subtotal,
      COPY.totals.shipping,
      COPY.totals.total,
    ]);
    await expect(orderSummary(page).getByRole("definition")).toHaveText([
      usd(product.priceCents * 2),
      "$5.95",
      usd(product.priceCents * 2 + 595),
    ]);
  });

  test("[BR-K2] shows every required error after submit and focuses Email", async ({
    page,
  }) => {
    await openCheckout(page, "lavender-dusk", 1);
    const errors = COPY.checkout.errors;

    await placeOrder(page);

    for (const message of [
      errors.emailRequired,
      errors.fullNameRequired,
      errors.line1Required,
      errors.cityRequired,
      errors.postalCodeRequired,
      errors.countryRequired,
      errors.cardNumberRequired,
      errors.expiryRequired,
      errors.cvcRequired,
    ]) {
      await expect(page.getByText(message, { exact: true })).toBeVisible();
    }
    await expect(page.getByLabel(EMAIL, { exact: true })).toBeFocused();
    await expect(page).toHaveURL(/\/checkout$/);
    expect(await orderCount(page.request)).toBe(0);
  });

  test("[BR-K2] errors update on every change after the first submit", async ({
    page,
  }) => {
    await openCheckout(page, "lavender-dusk", 1);
    const email = page.getByLabel(EMAIL, { exact: true });
    await placeOrder(page);
    await expect(
      page.getByText(COPY.checkout.errors.emailRequired, { exact: true }),
    ).toBeVisible();

    await email.fill("ada@example");

    await expect(
      page.getByText(COPY.checkout.errors.emailInvalid, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(COPY.checkout.errors.emailRequired, { exact: true }),
    ).toHaveCount(0);

    await email.fill(VALID_DETAILS.email);

    await expect(
      page.getByText(COPY.checkout.errors.emailInvalid, { exact: true }),
    ).toHaveCount(0);
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
  });

  test("[BR-K2] accepts non ASCII names and shows them on the confirmation", async ({
    page,
  }) => {
    await openCheckout(page, "lavender-dusk", 1);

    await fillCheckout(page, { fullName: "Zoë Ångström" });
    await placeOrder(page);

    await expectConfirmation(page);
    await expect(page.getByText("Zoë Ångström", { exact: true })).toBeVisible();
  });

  test("[BR-K3] a declined card keeps the cart and the entered values", async ({
    page,
  }) => {
    await openCheckout(page, "lavender-dusk", 1);

    await fillCheckout(page, { cardNumber: "4000 0000 0000 0002" });
    await placeOrder(page);

    await expect(alertWith(page, COPY.checkout.declined)).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(cartBadge(page)).toHaveAccessibleName(COPY.header.cart(1));
    await expect(page.getByLabel(EMAIL, { exact: true })).toHaveValue(
      VALID_DETAILS.email,
    );
    await expect(
      page.getByLabel(COPY.checkout.labels.cardNumber, { exact: true }),
    ).toHaveValue("4000 0000 0000 0002");
    expect(await orderCount(page.request)).toBe(0);
  });

  test("[BR-K4] sold out during checkout updates the cart and allows a retry", async ({
    page,
  }) => {
    const product = bySlug("ember-clove");
    await openCheckout(page, product.slug, 3);
    await fillCheckout(page);

    await setProduct(page.request, product.slug, { stock: 1 });
    await placeOrder(page);

    await expect(
      alertWith(page, COPY.checkout.outOfStock(product.name)),
    ).toBeVisible();
    await expect(summaryLine(page, product.name, 1)).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByLabel(EMAIL, { exact: true })).toHaveValue(
      VALID_DETAILS.email,
    );
    await expect(cartBadge(page)).toHaveAccessibleName(COPY.header.cart(1));

    await placeOrder(page);

    await expectConfirmation(page);
    await expect(
      page
        .getByRole("list", { name: COPY.confirmation.items })
        .getByRole("listitem"),
    ).toContainText(COPY.confirmation.line(product.name, 1));
  });

  test("[BR-K4] selling out the only item sends the customer to the empty cart", async ({
    page,
  }) => {
    const product = bySlug("last-light");
    await openCheckout(page, product.slug, 1);
    await fillCheckout(page);

    await setProduct(page.request, product.slug, { stock: 0 });
    await placeOrder(page);

    await expect(page).toHaveURL(/\/cart$/);
    await expectEmptyCart(page);
    await expect(cartBadge(page)).toHaveAccessibleName(COPY.header.cart(0));
  });

  test("[BR-K4] a price change during checkout shows the new price and allows a retry", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");
    await openCheckout(page, product.slug, 1);
    await fillCheckout(page);

    await setProduct(page.request, product.slug, { priceCents: 1900 });
    await placeOrder(page);

    await expect(alertWith(page, COPY.checkout.priceChanged)).toBeVisible();
    await expect(summaryLine(page, product.name, 1)).toContainText(usd(1900));
    await expect(orderSummary(page).getByRole("definition")).toHaveText([
      usd(1900),
      usd(595),
      usd(2495),
    ]);
    await expect(page).toHaveURL(/\/checkout$/);

    await placeOrder(page);

    await expectConfirmation(page);
    await expect(page.getByRole("definition")).toHaveText([
      usd(1900),
      usd(595),
      usd(2495),
    ]);
  });

  test("[BR-K5] a successful order shows the confirmation and empties the cart", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");
    await openCheckout(page, product.slug, 2);

    await fillCheckout(page);
    await placeOrder(page);

    await expectConfirmation(page);
    const orderNumber = orderNumberOf(page);
    await expect(page).toHaveTitle(COPY.title.order(orderNumber));
    await expect(
      page.getByText(COPY.confirmation.orderNumber(orderNumber), {
        exact: true,
      }),
    ).toBeVisible();
    const items = page
      .getByRole("list", { name: COPY.confirmation.items })
      .getByRole("listitem");
    await expect(items).toHaveCount(1);
    await expect(items).toContainText(COPY.confirmation.line(product.name, 2));
    await expect(items).toContainText(usd(product.priceCents * 2));
    await expect(page.getByRole("term")).toHaveText([
      COPY.totals.subtotal,
      COPY.totals.shipping,
      COPY.totals.total,
    ]);
    await expect(page.getByRole("definition")).toHaveText([
      "$36.00",
      "$5.95",
      "$41.95",
    ]);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: COPY.confirmation.shippingTo,
      }),
    ).toBeVisible();
    for (const line of [
      VALID_DETAILS.fullName,
      VALID_DETAILS.line1,
      COPY.confirmation.cityLine(VALID_DETAILS.city, VALID_DETAILS.postalCode),
      COPY.checkout.countries.GB,
    ]) {
      await expect(page.getByText(line, { exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole("link", { name: COPY.confirmation.continueShopping }),
    ).toHaveAttribute("href", "/");
    await expect(cartBadge(page)).toHaveAccessibleName(COPY.header.cart(0));
    expect(await productStock(page.request, product.slug)).toBe(
      product.stock - 2,
    );

    await page.goto("/cart");
    await expectEmptyCart(page);
  });

  test("[BR-K6] [KD-05] a double click on Place order", async ({ page }) => {
    await openCheckout(page, "lavender-dusk", 1);
    await fillCheckout(page);

    await page
      .getByRole("button", { name: COPY.checkout.placeOrder })
      .dblclick();

    await expect(
      page.getByRole("heading", { level: 1, name: COPY.confirmation.heading }),
    ).toBeVisible();
    const expected = byTarget("KD-05", { legacy: 2, next: 1 });
    await expect.poll(() => orderCount(page.request)).toBe(expected);
    expect(await orderCount(page.request)).toBe(expected);
  });

  test("[BR-K7] [KD-02] an unknown order number shows not found", async ({
    page,
  }) => {
    const response = await page.goto("/order/WC-NOPE00");

    expect(response?.status()).toBe(
      byTarget("KD-02", { legacy: 200, next: 404 }),
    );
    await expectNotFound(page);
  });
});
