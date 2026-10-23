import { expect, type Locator, type Page } from "@playwright/test";
import { CATALOG } from "./catalog.js";
import { COPY } from "./copy.js";

function productNamed(name: string) {
  const product = CATALOG.find((candidate) => candidate.name === name);
  if (product === undefined) {
    throw new Error(`No product named "${name}" in the catalog`);
  }
  return product;
}

async function expectCartMessage(page: Page): Promise<void> {
  await expect(page.getByRole("status")).toHaveText(/\S/);
}

export function cartBadge(page: Page): Locator {
  return page
    .getByRole("banner")
    .getByRole("navigation", { name: COPY.header.nav })
    .getByRole("link", { name: /Cart \(\d+\)/ });
}

export async function addFromList(page: Page, name: string): Promise<void> {
  const product = productNamed(name);
  await page.goto(`/?family=${product.family}`);
  await page
    .getByRole("list", { name: COPY.list.products })
    .getByRole("listitem")
    .filter({
      has: page.getByRole("heading", {
        level: 2,
        name: product.name,
        exact: true,
      }),
    })
    .getByRole("button", { name: COPY.addToCart })
    .click();
  await expectCartMessage(page);
}

export async function addFromDetail(
  page: Page,
  slug: string,
  quantity: number,
): Promise<void> {
  await page.goto(`/products/${slug}`);
  await page
    .getByRole("spinbutton", { name: COPY.product.quantity })
    .fill(String(quantity));
  await page.getByRole("button", { name: COPY.addToCart }).click();
  await expectCartMessage(page);
}
