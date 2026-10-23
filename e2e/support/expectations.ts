import { expect, type Page } from "@playwright/test";
import { COPY } from "./copy.js";

export async function expectNotFound(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.notFound.heading }),
  ).toBeVisible();
  await expect(page.getByText(COPY.notFound.text)).toBeVisible();
  await expect(
    page.getByRole("link", { name: COPY.notFound.backToShop }),
  ).toHaveAttribute("href", "/");
  await expect(page).toHaveTitle(COPY.title.notFound);
}

export async function expectEmptyCart(page: Page): Promise<void> {
  await expect(page.getByText(COPY.cart.empty)).toBeVisible();
  await expect(
    page.getByRole("link", { name: COPY.cart.continueShopping }),
  ).toHaveAttribute("href", "/");
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: COPY.cart.checkout, exact: true }),
  ).toHaveCount(0);
}
