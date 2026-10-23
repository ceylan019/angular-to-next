import { expect, type Page } from "@playwright/test";
import { addFromDetail } from "./cart.js";
import { bySlug } from "./catalog.js";
import { COPY } from "./copy.js";

export const VALID_DETAILS = {
  email: "ada@example.com",
  fullName: "Ada Lovelace",
  line1: "12 Analytical Way",
  city: "London",
  postalCode: "SW1A 1AA",
  country: "United Kingdom",
  cardNumber: "4242 4242 4242 4242",
  expiry: "12/40",
  cvc: "123",
};

export type CheckoutDetails = Partial<typeof VALID_DETAILS>;

export async function fillCheckout(
  page: Page,
  overrides: CheckoutDetails = {},
): Promise<void> {
  const details = { ...VALID_DETAILS, ...overrides };
  const labels = COPY.checkout.labels;
  await page.getByLabel(labels.email, { exact: true }).fill(details.email);
  await page
    .getByLabel(labels.fullName, { exact: true })
    .fill(details.fullName);
  await page.getByLabel(labels.line1, { exact: true }).fill(details.line1);
  await page.getByLabel(labels.city, { exact: true }).fill(details.city);
  await page
    .getByLabel(labels.postalCode, { exact: true })
    .fill(details.postalCode);
  await page
    .getByLabel(labels.country, { exact: true })
    .selectOption({ label: details.country });
  await page
    .getByLabel(labels.cardNumber, { exact: true })
    .fill(details.cardNumber);
  await page.getByLabel(labels.expiry, { exact: true }).fill(details.expiry);
  await page.getByLabel(labels.cvc, { exact: true }).fill(details.cvc);
}

export async function placeOrder(page: Page): Promise<void> {
  await page.getByRole("button", { name: COPY.checkout.placeOrder }).click();
}

export function orderSummary(page: Page) {
  return page.getByRole("complementary", { name: COPY.checkout.summary });
}

export function summaryLine(page: Page, name: string, quantity: number) {
  return orderSummary(page)
    .getByRole("listitem")
    .filter({ hasText: COPY.checkout.summaryLine(name, quantity) });
}

export async function openCheckout(
  page: Page,
  slug: string,
  quantity: number,
): Promise<void> {
  const product = bySlug(slug);
  await addFromDetail(page, slug, quantity);
  await page.goto("/checkout");
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.checkout.heading }),
  ).toBeVisible();
  await expect(summaryLine(page, product.name, quantity)).toBeVisible();
  await expect(
    page.getByRole("button", { name: COPY.checkout.placeOrder }),
  ).toBeEnabled();
}
