import type { Page } from "@playwright/test";
import {
  CATALOG,
  bySlug,
  sortedByName,
  sortedByPrice,
} from "../../support/catalog.js";
import { COPY } from "../../support/copy.js";
import { expect, test } from "../../support/fixtures.js";
import { usd } from "../../support/money.js";

const PAGE_SIZE = 12;

function names(products: readonly { name: string }[]): string[] {
  return products.map((product) => product.name);
}

function cards(page: Page) {
  return page
    .getByRole("list", { name: COPY.list.products })
    .getByRole("listitem");
}

function cardNames(page: Page) {
  return cards(page).getByRole("heading", { level: 2 });
}

function pagination(page: Page) {
  return page.getByRole("navigation", { name: COPY.list.pagination.label });
}

function family(page: Page, label: string) {
  return page
    .getByRole("group", { name: COPY.list.families.legend })
    .getByRole("checkbox", { name: label, exact: true });
}

function floralByName() {
  return sortedByName(CATALOG.filter((product) => product.family === "floral"));
}

test.describe("product list @browse", () => {
  test("[BR-B1] lists 12 candles on page 1 with name, price and stock status", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: COPY.list.heading }),
    ).toBeVisible();
    await expect(cards(page)).toHaveCount(PAGE_SIZE);
    await expect(cardNames(page)).toHaveText(
      names(sortedByName().slice(0, PAGE_SIZE)),
    );

    const first = bySlug("birch-and-pine");
    const card = cards(page).first();
    await expect(
      card.getByText(usd(first.priceCents), { exact: true }),
    ).toBeVisible();
    await expect(
      card.getByText(COPY.stock(first.stock), { exact: true }),
    ).toBeVisible();
    await expect(
      card.getByRole("link", { name: first.name, exact: true }),
    ).toHaveAttribute("href", `/products/${first.slug}`);
    await expect(
      card.getByRole("button", { name: COPY.addToCart }),
    ).toBeEnabled();
  });

  test("[BR-B1] shows the low stock status on the card", async ({ page }) => {
    await page.goto("/?family=spicy");

    const lowStock = bySlug("ember-clove");
    const card = cards(page).filter({
      has: page.getByRole("heading", { name: lowStock.name }),
    });
    await expect(
      card.getByText(COPY.stock(lowStock.stock), { exact: true }),
    ).toBeVisible();
  });

  test("[BR-B3] offers the three sort options with name A to Z selected", async ({
    page,
  }) => {
    await page.goto("/");

    const sort = page.getByLabel(COPY.list.sort.label);
    await expect(sort.getByRole("option")).toHaveText(
      Object.values(COPY.list.sort.options),
    );
    await expect(sort).toHaveValue("name-asc");
  });

  test("[BR-B3] sorts by price low to high with ties broken by name", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByLabel(COPY.list.sort.label).selectOption("price-asc");

    await expect(page).toHaveURL("/?sort=price-asc");
    await expect(cardNames(page)).toHaveText(
      names(sortedByPrice("asc").slice(0, PAGE_SIZE)),
    );
  });

  test("[BR-B3] sorts by price high to low", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(COPY.list.sort.label).selectOption("price-desc");

    await expect(page).toHaveURL("/?sort=price-desc");
    await expect(cardNames(page)).toHaveText(
      names(sortedByPrice("desc").slice(0, PAGE_SIZE)),
    );
  });

  test("[BR-B3] changing the sort drops the page", async ({ page }) => {
    await page.goto("/?page=2");

    await page.getByLabel(COPY.list.sort.label).selectOption("price-asc");

    await expect(page).toHaveURL("/?sort=price-asc");
    await expect(cardNames(page)).toHaveText(
      names(sortedByPrice("asc").slice(0, PAGE_SIZE)),
    );
  });

  test("[BR-B3] keeps the sort when a filter changes", async ({ page }) => {
    await page.goto("/?sort=price-desc");

    await family(page, "Floral").check();

    await expect(page).toHaveURL("/?family=floral&sort=price-desc");
    await expect(cardNames(page)).toHaveText(
      names(
        sortedByPrice(
          "desc",
          CATALOG.filter((product) => product.family === "floral"),
        ),
      ),
    );
  });

  test("[BR-B2] filters by Floral and Woody, keeps them in the URL and resets the page", async ({
    page,
  }) => {
    await page.goto("/?page=2");

    await family(page, "Floral").check();
    await expect(page).toHaveURL("/?family=floral");

    await family(page, "Woody").check();
    await expect(page).toHaveURL("/?family=floral&family=woody");

    const matching = sortedByName(
      CATALOG.filter(
        (product) => product.family === "floral" || product.family === "woody",
      ),
    );
    await expect(cards(page)).toHaveCount(PAGE_SIZE);
    await expect(cardNames(page)).toHaveText(
      names(matching.slice(0, PAGE_SIZE)),
    );
    await expect(family(page, "Floral")).toBeChecked();
    await expect(family(page, "Woody")).toBeChecked();
    await expect(family(page, "Fresh")).not.toBeChecked();
    await expect(
      pagination(page).getByRole("link", { name: "1", exact: true }),
    ).toBeVisible();
    await expect(
      pagination(page).getByRole("link", { name: "2", exact: true }),
    ).toBeVisible();
  });

  test("[BR-B2] writes families in canonical order whatever order they are chosen", async ({
    page,
  }) => {
    await page.goto("/");

    await family(page, "Woody").check();
    await family(page, "Floral").check();

    await expect(page).toHaveURL("/?family=floral&family=woody");
  });

  test("[BR-B2] unchecking the last family returns to the default URL", async ({
    page,
  }) => {
    await page.goto("/?family=floral");

    await family(page, "Floral").uncheck();

    await expect(page).toHaveURL("/");
    await expect(cards(page)).toHaveCount(PAGE_SIZE);
  });

  test("[BR-B2] lists the six scent families in order", async ({ page }) => {
    await page.goto("/");

    const group = page.getByRole("group", {
      name: COPY.list.families.legend,
    });
    await expect(group.getByRole("checkbox")).toHaveCount(
      COPY.list.families.options.length,
    );
    for (const [index, label] of COPY.list.families.options.entries()) {
      await expect(group.getByRole("checkbox").nth(index)).toHaveAccessibleName(
        label,
      );
    }
  });

  test("[BR-B4] paginates with Previous and Next", async ({ page }) => {
    await page.goto("/");

    const nav = pagination(page);
    await expect(
      nav.getByRole("link", { name: COPY.list.pagination.previous }),
    ).toHaveCount(0);
    await expect(
      nav.getByRole("link", { name: "1", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: COPY.list.pagination.next }).click();

    await expect(page).toHaveURL("/?page=2");
    await expect(cardNames(page)).toHaveText(
      names(sortedByName().slice(PAGE_SIZE, PAGE_SIZE * 2)),
    );
    await expect(
      nav.getByRole("link", { name: "2", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: "1", exact: true }),
    ).not.toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: COPY.list.pagination.previous }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: COPY.list.pagination.next }),
    ).toBeVisible();

    await nav.getByRole("link", { name: COPY.list.pagination.next }).click();

    await expect(page).toHaveURL("/?page=3");
    await expect(cardNames(page)).toHaveText(
      names(sortedByName().slice(PAGE_SIZE * 2)),
    );
    await expect(cards(page)).toHaveCount(CATALOG.length - PAGE_SIZE * 2);
    await expect(
      nav.getByRole("link", { name: "3", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: COPY.list.pagination.next }),
    ).toHaveCount(0);

    await nav
      .getByRole("link", { name: COPY.list.pagination.previous })
      .click();
    await expect(page).toHaveURL("/?page=2");

    await nav
      .getByRole("link", { name: COPY.list.pagination.previous })
      .click();
    await expect(page).toHaveURL("/");
  });

  test("[BR-B4] page number links keep the families and sort", async ({
    page,
  }) => {
    await page.goto("/?family=floral&family=woody&sort=price-asc");

    await pagination(page)
      .getByRole("link", { name: "2", exact: true })
      .click();

    await expect(page).toHaveURL(
      "/?family=floral&family=woody&sort=price-asc&page=2",
    );
    await expect(cards(page)).toHaveCount(1);
  });

  test("[BR-B4] shows no pagination when everything fits on one page", async ({
    page,
  }) => {
    await page.goto("/?family=floral");

    await expect(cards(page)).toHaveCount(floralByName().length);
    await expect(pagination(page)).toHaveCount(0);
  });

  test("[BR-B4] an out of range page shows the empty page message", async ({
    page,
  }) => {
    await page.goto("/?page=9");

    await expect(page.getByText(COPY.list.emptyPage)).toBeVisible();
    await expect(
      page.getByRole("list", { name: COPY.list.products }),
    ).toHaveCount(0);
    await expect(pagination(page)).toHaveCount(0);

    await page.getByRole("link", { name: COPY.list.firstPage }).click();

    await expect(cards(page)).toHaveCount(PAGE_SIZE);
    await expect(cardNames(page)).toHaveText(
      names(sortedByName().slice(0, PAGE_SIZE)),
    );
  });

  test("[BR-B4] the first page link of an empty page keeps families and sort", async ({
    page,
  }) => {
    await page.goto("/?family=floral&sort=price-desc&page=3");

    await expect(page.getByText(COPY.list.emptyPage)).toBeVisible();
    await page.getByRole("link", { name: COPY.list.firstPage }).click();

    await expect(page).toHaveURL("/?family=floral&sort=price-desc");
    await expect(cards(page)).toHaveCount(floralByName().length);
  });

  test("[BR-B4] invalid query values fall back to defaults", async ({
    page,
  }) => {
    await page.goto(
      "/?page=abc&sort=PRICE-ASC&family=floral&family=floral&family=nope",
    );

    await expect(cardNames(page)).toHaveText(names(floralByName()));
    for (const label of COPY.list.families.options) {
      if (label === "Floral") {
        await expect(family(page, label)).toBeChecked();
      } else {
        await expect(family(page, label)).not.toBeChecked();
      }
    }
    await expect(page.getByLabel(COPY.list.sort.label)).toHaveValue("name-asc");
  });

  for (const value of ["0", "-1", "1.5", "1e3", "abc", "10000"]) {
    test(`[BR-B4] page=${value} falls back to the first page`, async ({
      page,
    }) => {
      await page.goto(`/?page=${value}`);

      await expect(cardNames(page)).toHaveText(
        names(sortedByName().slice(0, PAGE_SIZE)),
      );
    });
  }

  test("[BR-B4] the largest accepted page number shows the empty page message", async ({
    page,
  }) => {
    await page.goto("/?page=9999");

    await expect(page.getByText(COPY.list.emptyPage)).toBeVisible();
  });

  test("[BR-B5] no matches shows the message and Clear filters", async ({
    page,
  }) => {
    await page.goto("/?family=herbal");

    await expect(page.getByText(COPY.list.noMatches)).toBeVisible();
    await expect(
      page.getByRole("list", { name: COPY.list.products }),
    ).toHaveCount(0);
    await expect(pagination(page)).toHaveCount(0);
    await expect(family(page, "Herbal")).toBeChecked();

    await page.getByRole("link", { name: COPY.list.clearFilters }).click();

    await expect(page).toHaveURL("/");
    await expect(cards(page)).toHaveCount(PAGE_SIZE);
    await expect(family(page, "Herbal")).not.toBeChecked();
  });
});
