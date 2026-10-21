import { COPY } from "../../support/copy.js";
import { expect, test } from "../../support/fixtures.js";

const PAGE_SIZE = 12;

const CARD = `
  - listitem:
    - heading [level=2]:
      - link /.+/:
        - /url: /^\\/products\\/[a-z0-9-]+$/
    - button "${COPY.addToCart}"
`;

const FAMILIES = COPY.list.families.options
  .map((label) => `    - checkbox "${label}"`)
  .join("\n");

const SORT_OPTIONS = Object.values(COPY.list.sort.options)
  .map((label) => `    - 'option "${label}"'`)
  .join("\n");

test.describe("browse structure @browse", () => {
  test("[BR-B1] product card structure", async ({ page }) => {
    await page.goto("/");
    const cards = page
      .getByRole("list", { name: COPY.list.products })
      .getByRole("listitem");

    await expect(cards).toHaveCount(PAGE_SIZE);
    await expect(cards.first()).toMatchAriaSnapshot(CARD);
  });

  test("[BR-B1] product card shows a price and a stock status", async ({
    page,
  }) => {
    await page.goto("/");

    const card = page
      .getByRole("list", { name: COPY.list.products })
      .getByRole("listitem")
      .first();

    await expect(card).toContainText(/\$\d+\.\d{2}/);
    await expect(card).toContainText(/In stock|Only \d left|Out of stock/);
  });

  test("[BR-B1] product list holds one card per product", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("list", { name: COPY.list.products }),
    ).toMatchAriaSnapshot(
      `\n  - list "${COPY.list.products}":\n${Array.from(
        { length: PAGE_SIZE },
        () =>
          CARD.trimEnd()
            .split("\n")
            .map((line) => `  ${line}`)
            .join("\n"),
      ).join("\n")}\n`,
    );
  });

  test("[BR-B2] filter structure", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("group", { name: COPY.list.families.legend }),
    ).toMatchAriaSnapshot(
      `\n  - group "${COPY.list.families.legend}":\n${FAMILIES}\n`,
    );
  });

  test("[BR-B3] sort structure", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("combobox", { name: COPY.list.sort.label }),
    ).toMatchAriaSnapshot(
      `\n  - combobox "${COPY.list.sort.label}":\n${SORT_OPTIONS}\n`,
    );
  });
});
