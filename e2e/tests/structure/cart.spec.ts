import { addFromDetail } from "../../support/cart.js";
import { bySlug } from "../../support/catalog.js";
import { COPY } from "../../support/copy.js";
import { expect, test } from "../../support/fixtures.js";

const PRODUCT = bySlug("lavender-dusk");
const QUANTITY = 2;

const HEADER_ROW = `
  - row:
${COPY.cart.columns.map((column) => `    - columnheader "${column}"`).join("\n")}
`;

const PRODUCT_ROW = `
  - row:
    - cell:
      - link "${PRODUCT.name}"
    - cell /\\$\\d+\\.\\d{2}/
    - cell:
      - spinbutton "${COPY.cart.quantityFor(PRODUCT.name)}": "${String(QUANTITY)}"
    - cell /\\$\\d+\\.\\d{2}/
    - cell:
      - button "${COPY.cart.removeItem(PRODUCT.name)}"
`;

const TOTALS = `
  - term: ${COPY.totals.subtotal}
  - definition: /\\$[\\d,]+\\.\\d{2}/
  - term: ${COPY.totals.shipping}
  - definition: /\\$[\\d,]+\\.\\d{2}|${COPY.free}/
  - term: ${COPY.totals.total}
  - definition: /\\$[\\d,]+\\.\\d{2}/
`;

test.describe("cart structure @cart", () => {
  test("[BR-C5] cart table and summary structure", async ({ page }) => {
    await addFromDetail(page, PRODUCT.slug, QUANTITY);

    await page.goto("/cart");

    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByRole("row").first()).toMatchAriaSnapshot(
      HEADER_ROW,
    );
    await expect(table.getByRole("row").last()).toMatchAriaSnapshot(
      PRODUCT_ROW,
    );
    await expect(page.getByRole("main")).toMatchAriaSnapshot(TOTALS);
    await expect(
      page.getByRole("link", { name: COPY.cart.checkout, exact: true }),
    ).toMatchAriaSnapshot(`
      - link "${COPY.cart.checkout}":
        - /url: /checkout
    `);
  });
});
