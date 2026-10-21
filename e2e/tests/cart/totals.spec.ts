import type { Page } from "@playwright/test";
import { addFromDetail } from "../../support/cart.js";
import { bySlug } from "../../support/catalog.js";
import { COPY } from "../../support/copy.js";
import { expect, test } from "../../support/fixtures.js";
import { byTarget } from "../../support/known-differences.js";

type Totals = { subtotal: string; shipping: string; total: string };

async function expectTotals(page: Page, totals: Totals): Promise<void> {
  await page.goto("/cart");
  await expect(page.getByRole("term")).toHaveText([
    COPY.totals.subtotal,
    COPY.totals.shipping,
    COPY.totals.total,
  ]);
  await expect(page.getByRole("definition")).toHaveText([
    totals.subtotal,
    totals.shipping,
    totals.total,
  ]);
}

test.describe("cart totals @cart", () => {
  test("[BR-C5] charges shipping below $50.00", async ({ page }) => {
    await addFromDetail(page, bySlug("cedar-smoke").slug, 1);
    await addFromDetail(page, bySlug("honey-oat").slug, 1);

    await expectTotals(page, {
      subtotal: "$49.75",
      shipping: "$5.95",
      total: "$55.70",
    });
  });

  test("[BR-C5] charges shipping on a single cheap candle", async ({
    page,
  }) => {
    await addFromDetail(page, bySlug("lavender-dusk").slug, 1);

    await expectTotals(page, {
      subtotal: "$18.00",
      shipping: "$5.95",
      total: "$23.95",
    });
  });

  test("[BR-C5] [KD-03] ships free at exactly $50.00", async ({ page }) => {
    await addFromDetail(page, bySlug("cedar-smoke").slug, 2);

    await expectTotals(page, {
      subtotal: "$50.00",
      shipping: byTarget("KD-03", { legacy: "$5.95", next: COPY.free }),
      total: byTarget("KD-03", { legacy: "$55.95", next: "$50.00" }),
    });
  });

  test("[BR-C5] ships free above $50.00", async ({ page }) => {
    await addFromDetail(page, bySlug("cedar-smoke").slug, 1);
    await addFromDetail(page, bySlug("rose-quartz").slug, 1);

    await expectTotals(page, {
      subtotal: "$50.25",
      shipping: COPY.free,
      total: "$50.25",
    });
  });

  test("[BR-C5] totals follow a quantity change across the free shipping threshold", async ({
    page,
  }) => {
    const product = bySlug("lavender-dusk");
    await addFromDetail(page, product.slug, 2);
    await expectTotals(page, {
      subtotal: "$36.00",
      shipping: "$5.95",
      total: "$41.95",
    });

    const quantity = page.getByRole("spinbutton", {
      name: COPY.cart.quantityFor(product.name),
    });
    await quantity.fill("3");
    await quantity.blur();

    await expect(page.getByRole("definition")).toHaveText([
      "$54.00",
      COPY.free,
      "$54.00",
    ]);
  });

  test("[BR-C5] [KD-01] keeps exact cents for a $16.15 candle", async ({
    page,
  }) => {
    await addFromDetail(page, bySlug("fig-cassis").slug, 1);

    await expectTotals(page, {
      subtotal: byTarget("KD-01", { legacy: "$16.14", next: "$16.15" }),
      shipping: "$5.95",
      total: byTarget("KD-01", { legacy: "$22.09", next: "$22.10" }),
    });
  });
});
