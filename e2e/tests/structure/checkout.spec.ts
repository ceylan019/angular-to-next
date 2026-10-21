import { addFromDetail } from "../../support/cart.js";
import { bySlug } from "../../support/catalog.js";
import { openCheckout } from "../../support/checkout.js";
import { COPY } from "../../support/copy.js";
import { expect, test } from "../../support/fixtures.js";

const PRODUCT = bySlug("lavender-dusk");
const QUANTITY = 2;
const LABELS = COPY.checkout.labels;
const LEGENDS = COPY.checkout.legends;

const COUNTRY_OPTIONS = [
  COPY.checkout.countryPlaceholder,
  ...Object.values(COPY.checkout.countries),
]
  .map((label) => `        - option "${label}"`)
  .join("\n");

const FORM = `
  - heading "${COPY.checkout.heading}" [level=1]
  - group "${LEGENDS.contact}":
    - textbox "${LABELS.email}"
  - group "${LEGENDS.shipping}":
    - textbox "${LABELS.fullName}"
    - textbox "${LABELS.line1}"
    - textbox "${LABELS.line2}"
    - textbox "${LABELS.city}"
    - textbox "${LABELS.postalCode}"
    - combobox "${LABELS.country}":
${COUNTRY_OPTIONS}
  - group "${LEGENDS.payment}":
    - textbox "${LABELS.cardNumber}"
    - textbox "${LABELS.expiry}"
    - textbox "${LABELS.cvc}"
  - button "${COPY.checkout.placeOrder}"
`;

const SUMMARY_LINE = `
  - listitem: /${PRODUCT.name} \\u00d7 ${String(QUANTITY)} \\$[\\d,]+\\.\\d{2}/
`;

const SUMMARY = `
  - complementary "${COPY.checkout.summary}":
    - term: ${COPY.totals.subtotal}
    - definition: /\\$[\\d,]+\\.\\d{2}/
    - term: ${COPY.totals.shipping}
    - definition: /\\$[\\d,]+\\.\\d{2}|${COPY.free}/
    - term: ${COPY.totals.total}
    - definition: /\\$[\\d,]+\\.\\d{2}/
`;

test.describe("checkout structure @checkout", () => {
  test("[BR-K2] checkout form structure", async ({ page }) => {
    await openCheckout(page, PRODUCT.slug, QUANTITY);

    await expect(page.getByRole("main")).toMatchAriaSnapshot(FORM);
  });

  test("[BR-K2] order summary structure", async ({ page }) => {
    await addFromDetail(page, PRODUCT.slug, QUANTITY);

    await page.goto("/checkout");

    await expect(
      page.getByRole("complementary", { name: COPY.checkout.summary }),
    ).toMatchAriaSnapshot(SUMMARY);
    await expect(
      page
        .getByRole("complementary", { name: COPY.checkout.summary })
        .getByRole("listitem"),
    ).toMatchAriaSnapshot(SUMMARY_LINE);
  });
});
