import { addFromDetail } from "../../support/cart.js";
import { fillCheckout, placeOrder } from "../../support/checkout.js";
import type { CheckoutDetails } from "../../support/checkout.js";
import { COPY } from "../../support/copy.js";
import { orderCount } from "../../support/backend.js";
import { expect, test } from "../../support/fixtures.js";

const LABELS = COPY.checkout.labels;
const ERRORS = COPY.checkout.errors;

type Row = {
  title: string;
  field: keyof CheckoutDetails;
  label: string;
  value: string;
  message: string;
};

const ROWS: readonly Row[] = [
  {
    title: "email without a top level domain",
    field: "email",
    label: LABELS.email,
    value: "ada@example",
    message: ERRORS.emailInvalid,
  },
  {
    title: "postal code that is too short",
    field: "postalCode",
    label: LABELS.postalCode,
    value: "AB",
    message: ERRORS.postalCodeInvalid,
  },
  {
    title: "card number that fails the Luhn check",
    field: "cardNumber",
    label: LABELS.cardNumber,
    value: "4242 4242 4242 4241",
    message: ERRORS.cardNumberInvalid,
  },
  {
    title: "expiry month 13",
    field: "expiry",
    label: LABELS.expiry,
    value: "13/40",
    message: ERRORS.expiryFormat,
  },
  {
    title: "expiry in the past",
    field: "expiry",
    label: LABELS.expiry,
    value: "01/20",
    message: ERRORS.expiryPast,
  },
  {
    title: "CVC with two digits",
    field: "cvc",
    label: LABELS.cvc,
    value: "12",
    message: ERRORS.cvcInvalid,
  },
  {
    title: "full name of 101 characters",
    field: "fullName",
    label: LABELS.fullName,
    value: "A".repeat(101),
    message: ERRORS.max100,
  },
];

test.describe("checkout validation @checkout", () => {
  for (const row of ROWS) {
    test(`[BR-K2] ${row.title} is rejected`, async ({ page }) => {
      await addFromDetail(page, "lavender-dusk", 1);
      await page.goto("/checkout");
      await expect(
        page.getByRole("button", { name: COPY.checkout.placeOrder }),
      ).toBeEnabled();
      await expect(
        page
          .getByRole("complementary", { name: COPY.checkout.summary })
          .getByRole("listitem"),
      ).toHaveCount(1);

      await fillCheckout(page, { [row.field]: row.value });
      await placeOrder(page);

      await expect(page.getByText(row.message, { exact: true })).toBeVisible();
      await expect(page.getByLabel(row.label, { exact: true })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(page).toHaveURL(/\/checkout$/);
      expect(await orderCount(page.request)).toBe(0);
    });
  }
});
