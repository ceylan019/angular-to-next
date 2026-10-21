import type { Page } from "@playwright/test";
import { bySlug, sortedByName } from "../../support/catalog.js";
import { COPY } from "../../support/copy.js";
import { expect, test } from "../../support/fixtures.js";
import { usd } from "../../support/money.js";

const PAGE_SIZE = 12;

function description(page: Page) {
  return page.locator('meta[name="description"]');
}

test.describe("server rendering @browse", () => {
  test("[BR-B9] list and detail are server rendered with title and description", async ({
    noJsPage,
  }) => {
    const page = await noJsPage();

    await page.goto("/");

    await expect(page).toHaveTitle(COPY.title.list);
    await expect(description(page)).toHaveAttribute(
      "content",
      COPY.metaDescription,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: COPY.list.heading }),
    ).toBeVisible();
    const cards = page
      .getByRole("list", { name: COPY.list.products })
      .getByRole("listitem");
    await expect(cards).toHaveCount(PAGE_SIZE);
    await expect(cards.getByRole("heading", { level: 2 })).toHaveText(
      sortedByName()
        .slice(0, PAGE_SIZE)
        .map((product) => product.name),
    );

    const product = bySlug("lavender-dusk");
    await page.goto(`/products/${product.slug}`);

    await expect(page).toHaveTitle(COPY.title.product(product.name));
    await expect(description(page)).toHaveAttribute("content", product.summary);
    await expect(
      page.getByRole("heading", { level: 1, name: product.name }),
    ).toBeVisible();
    await expect(
      page.getByText(usd(product.priceCents), { exact: true }),
    ).toBeVisible();
  });

  test("[BR-B9] a list with no matches is server rendered", async ({
    noJsPage,
  }) => {
    const page = await noJsPage();

    await page.goto("/?family=herbal");

    await expect(page.getByText(COPY.list.noMatches)).toBeVisible();
    await expect(
      page.getByRole("link", { name: COPY.list.clearFilters }),
    ).toHaveAttribute("href", "/");
    await expect(page).toHaveTitle(COPY.title.list);
  });

  test("[BR-B9] the list pagination is server rendered", async ({
    noJsPage,
  }) => {
    const page = await noJsPage();

    await page.goto("/?page=2");

    const nav = page.getByRole("navigation", {
      name: COPY.list.pagination.label,
    });
    await expect(
      nav.getByRole("link", { name: "2", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: COPY.list.pagination.previous }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: COPY.list.pagination.next }),
    ).toBeVisible();
  });

  test("[BR-B9] the detail page carries its own details on the server", async ({
    noJsPage,
  }) => {
    const page = await noJsPage();
    const product = bySlug("ember-clove");

    await page.goto(`/products/${product.slug}`);

    await expect(
      page.getByText(COPY.stock(product.stock), { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(COPY.product.scentNotes(product.scentNotes), {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(COPY.product.burnTime(product.burnTimeHours), {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(COPY.product.size(product.sizeOz), { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("spinbutton", { name: COPY.product.quantity }),
    ).toHaveAttribute("max", String(product.stock));
  });
});
