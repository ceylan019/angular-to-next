# Known differences

The legacy app breaks rules from [requirements.md](requirements.md) in six known ways. KD-01 to KD-05 were planted on purpose, so the migration has real defects to preserve in the record and to fix in the rewrite. KD-06 was not planted: the parity review of the cart rewrite found it.

The legacy unit tests encode the old behavior: they are strong tests of a wrong reading of the rule. The shared Playwright suite asserts both sides through one helper, `byTarget` in `e2e/support/known-differences.ts`, which takes the known difference ID and the expected value per target. The legacy project expects the old behavior, the next project expects the rule. A shared test without a known difference ID expects identical behavior on both.

Web unit tests for the new behavior land with the rewrite, flow by flow.

## KD-01 Cart amounts lose a cent

- **Rule:** BR-C5
- **Legacy behavior:** `ShopService.getSubtotal()` adds up `(l.product.priceCents / 100) * l.quantity` in floating point dollars and truncates the sum to cents with `Math.floor(sum * 100) / 100`. One Fig & Cassis at $16.15 shows a subtotal of $16.14 and a total of $22.09. Two show a subtotal of $32.29 beside a line total of $32.30, because line totals go through the currency pipe, which rounds. Three happen to come out exact at $48.45.
- **New behavior:** amounts are integer cents from the backend to the page, so the subtotal is always exact: one Fig & Cassis shows $16.15 and a total of $22.10.
- **Legacy unit tests that encode it:**
  - `legacy/src/app/shop.service.spec.ts`: "[BR-C5] [KD-01] truncates the subtotal of a $16.15 candle to $16.14"
  - `legacy/src/app/shop.service.spec.ts`: "[BR-C5] [KD-01] the formula does not truncate every quantity of the $16.15 candle"
  - `legacy/src/app/cart/cart.component.spec.ts`: "[BR-C5] [KD-01] shows a correct line total beside a truncated subtotal"
  - `legacy/src/app/cart/cart.component.spec.ts`: "[BR-C5] [KD-01] shows an exact subtotal when nothing truncates"
  - `legacy/src/app/checkout/checkout.component.spec.ts`: "[BR-C5] [KD-01] checkout summary truncates the subtotal beside a correct line total"
- **Shared tests that assert it:**
  - `e2e/tests/cart/totals.spec.ts`: "[BR-C5] [KD-01] keeps exact cents for a $16.15 candle" expects a subtotal of $16.14 and a total of $22.09 on legacy, and $16.15 and $22.10 on next.

## KD-02 Not found pages answer HTTP 200

- **Rules:** BR-B7, BR-K7
- **Legacy behavior:** the not found page never sets the response status, so server rendering answers 200 for an unknown route, an unknown product and an unknown order (a "soft 404"). The detail and confirmation pages render the not found component inline when the backend answers 404, and also on any other error.
- **New behavior:** the not found page answers HTTP 404 in all three cases.
- **Legacy unit tests that encode it:**
  - `legacy/src/app/app.component.spec.ts`: "[KD-02] routes unknown paths to the not found page"
  - `legacy/src/app/app.component.spec.ts`: "[KD-02] routes deep unknown paths with a query string to the not found page"
  - `legacy/src/app/product-detail/product-detail.component.spec.ts`: "[BR-B7] [KD-02] renders not found inline on a 404"
  - `legacy/src/app/product-detail/product-detail.component.spec.ts`: "[BR-B7] [KD-02] falls back to not found on other errors"
  - `legacy/src/app/order-confirmation/order-confirmation.component.spec.ts`: "[BR-K7] [KD-02] renders not found inline on a 404"
  - `legacy/src/app/order-confirmation/order-confirmation.component.spec.ts`: "[BR-K7] [KD-02] falls back to not found on other errors"
- **Shared tests that assert it:**
  - `e2e/tests/browse/detail.spec.ts`: "[BR-B7] [KD-02] an unknown product shows not found"
  - `e2e/tests/browse/detail.spec.ts`: "[KD-02] an unknown route shows not found"
  - `e2e/tests/checkout/checkout.spec.ts`: "[BR-K7] [KD-02] an unknown order number shows not found"

  Each expects status 200 on legacy and 404 on next, with the same not found page on both.

## KD-03 A subtotal of exactly $50.00 still pays shipping

- **Rule:** BR-C5
- **Legacy behavior:** free shipping is written as `this.getSubtotal() > 50 ? 0 : 5.95` in `ShopService.getShipping()` and again as `subtotal > 50 ? 0 : 5.95` in `CheckoutComponent.calcShipping()`. Both copies use "greater than" where the rule says "at or above", so a subtotal of exactly $50.00 is charged $5.95 for a total of $55.95.
- **New behavior:** shipping is free at exactly $50.00, so the total is $50.00.
- **Legacy unit tests that encode it:**
  - `legacy/src/app/shop.service.spec.ts`: "[BR-C5] [KD-03] charges shipping at exactly $50.00"
  - `legacy/src/app/cart/cart.component.spec.ts`: "[BR-C5] [KD-03] charges shipping at exactly $50.00"
  - `legacy/src/app/checkout/checkout.component.spec.ts`: "[BR-C5] [KD-03] checkout summary charges shipping at exactly $50.00"
  - `legacy/src/app/checkout/checkout.component.spec.ts`: "[BR-C5] [KD-03] copies the shipping rule into the component for a cart with items"
  - `legacy/src/app/checkout/checkout.component.spec.ts`: "[BR-C5] [KD-03] the copied shipping rule keeps the empty cart guard"
  - `legacy/src/app/checkout/checkout.component.spec.ts`: "[BR-C5] [KD-03] an empty cart rendered on the server ships free"
- **Shared tests that assert it:**
  - `e2e/tests/cart/totals.spec.ts`: "[BR-C5] [KD-03] ships free at exactly $50.00" expects shipping of $5.95 and a total of $55.95 on legacy, and Free and $50.00 on next.

## KD-04 The server rendered cart badge always shows 0

- **Rule:** BR-C4
- **Legacy behavior:** the cart lives in `localStorage` under the key `cart`, and `ShopService` reads it only in the browser. The server rendered HTML therefore always shows `Cart (0)`, and the badge corrects itself once the page has loaded in the browser.
- **New behavior:** the server rendered HTML shows the real count.
- **Legacy unit tests that encode it:**
  - `legacy/src/app/shop.service.spec.ts`: "[KD-04] never reads the cart on the server"
  - `legacy/src/app/shop.service.spec.ts`: "[KD-04] never writes the cart on the server"
- **Shared tests that assert it:**
  - `e2e/tests/cart/cart.spec.ts`: "[BR-C4] [KD-04] the server rendered badge" adds two candles, then loads the shop with JavaScript disabled in the same browser state, and expects `Cart (0)` on legacy and `Cart (2)` on next.

## KD-05 Place order stays enabled while the order is submitted

- **Rule:** BR-K6
- **Legacy behavior:** the place order button has no disabled binding and the submit handler has no guard against a request in flight, so every click posts an order and a double click places two orders.
- **New behavior:** the button is disabled and reads `Placing order...` while the order is submitted, so a double click places exactly one order.
- **Legacy unit tests that encode it:**
  - `legacy/src/app/checkout/checkout.component.spec.ts`: "[BR-K6] [KD-05] renders an enabled Place order submit button"
  - `legacy/src/app/checkout/checkout.component.spec.ts`: "[BR-K6] [KD-05] posts twice when Place order is clicked twice"
- **Shared tests that assert it:**
  - `e2e/tests/checkout/checkout.spec.ts`: "[BR-K6] [KD-05] a double click on Place order" expects two orders on legacy and one on next.

## KD-06 The legacy cart caps edits by the stock seen when the item was added

- **Rule:** BR-C2
- **Origin:** found by the parity review of the cart rewrite, not planted.
- **Legacy behavior:** `ShopService.addToCart()` stores the whole product, stock included, in the cart line and in `localStorage`. The cart page never fetches the product again, so `CartComponent.cap()` and `ShopService.updateQuantity()` cap a quantity edit at the lower of 10 and that stored stock. When the stock falls after the add, the cart still accepts edits up to the old stock. When it rises, the cart still caps at the old, lower stock. Adding the product again refreshes the stored copy. The legacy code has a branch for a stored stock of 0, but no path through the UI stores one: `addToCart()` refuses a line that would end below 1, `applyStockLimits()` deletes a line whose available stock is 0, and `loadCart()` drops a stored line whose quantity is above its stock. Only a unit test that changes the stored stock by hand reaches it.
- **New behavior:** the cart page fetches every product when it renders and `updateQuantity` fetches the product again on every edit, so the cap is the lower of 10 and the current stock. An edit above it clamps to the cap and shows the cap message. A line whose stock has fallen to 0 stays on the page with an input `max` of 0, and an edit removes the line without a message, because the page never shows "You can buy at most 0".
- **Where the two meet:** placing the order rechecks stock in the backend (BR-K4), so neither app sells more than the stock. The difference is only what the cart page accepts before checkout.
- **Legacy unit tests that encode it:**
  - `legacy/src/app/shop.service.spec.ts`: "[BR-C2] [KD-06] caps an edit by the stock stored at add time without asking the backend"
  - `legacy/src/app/shop.service.spec.ts`: "[BR-C2] [KD-06] a restored line keeps its stored stock as the cap"
- **Shared tests that assert it:**
  - `e2e/tests/cart/cart.spec.ts`: "[BR-C2] [KD-06] the cart caps edits by current stock" adds two Lavender Dusk, lowers its stock to 3 through the test API, then sets the cart quantity to 5. It expects 5, a badge of `Cart (5)` and an empty status region on legacy, and 3, `Cart (3)` and "You can buy at most 3 of Lavender Dusk." on next.
