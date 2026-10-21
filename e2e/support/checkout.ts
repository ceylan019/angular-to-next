import type { Page } from "@playwright/test";
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
