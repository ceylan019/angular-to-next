# Tech debt in the legacy app

Code level debt in `legacy/` that changes no behavior. The tests pass and the pages work, but each item makes the code harder to change safely or the shop worse to use. The behavior defects are tracked separately in [known-differences.md](known-differences.md).

## TypeScript strict mode is off, with `any` in many signatures

- **Where:** `legacy/tsconfig.json` sets no `strict` flag, so every strict check is off. `any` appears 35 times across nine files in `legacy/src/app`: every HTTP method of `shop.service.ts` returns `Observable<any>`, `models.ts` types a cart line's product as `any`, and `product-list.component.ts`, `product-detail.component.ts`, `order-confirmation.component.ts`, `checkout.component.ts`, `checkout-validators.ts`, `cart-not-empty.guard.ts` and `api-url.interceptor.ts` all take or hold `any`.
- **Why it hurts:** the compiler cannot catch a misspelled field, a missing null check or a backend response that changed shape. Those mistakes surface at runtime, in front of a customer.
- **How the rewrite removes it:** `strict` plus `noUncheckedIndexedAccess`, and zod validation at every boundary (backend responses, environment variables, URL search params, forms and server action inputs), so data is typed because it was checked.

## One `ShopService` does HTTP, cart state and totals

- **Where:** `legacy/src/app/shop.service.ts` holds every backend call, the cart and its observable count, the `localStorage` persistence and its sanitizing, the stock and price adjustments after a rejected order, and the subtotal, shipping and total arithmetic.
- **Why it hurts:** unrelated reasons to change meet in one class, and every component depends on all of it. Testing a pricing rule means building the HTTP client and the platform checks around it.
- **How the rewrite removes it:** server components fetch from the backend directly, while cart rules, money and validation are small modules of their own, each unit tested and mutation tested in isolation.

## Shipping logic is copy pasted between the cart and checkout

- **Where:** the cart page uses `ShopService.getShipping()` in `legacy/src/app/shop.service.ts`, and `CheckoutComponent.calcShipping()` in `legacy/src/app/checkout/checkout.component.ts` repeats the same `subtotal > 50 ? 0 : 5.95` with its own empty cart guard. The same habit shows elsewhere: the line cap `Math.min(10, stock)` is written in `shop.service.ts`, `cart/cart.component.ts` and `product-detail/product-detail.component.ts`.
- **Why it hurts:** a fix has to be made in every copy. KD-03 lives in both copies of the shipping rule, so correcting one would make the cart and the checkout disagree about the same order.
- **How the rewrite removes it:** one totals function used by both the cart page and the checkout summary, and one cart rules module that owns the cap.

## Nested `subscribe` calls and subscriptions that are never cleaned up

- **Where:** `product-list/product-list.component.ts`, `product-detail/product-detail.component.ts` and `order-confirmation/order-confirmation.component.ts` subscribe to the route and, inside that callback, subscribe again to the backend call. `cart/cart.component.ts` and `checkout/checkout.component.ts` subscribe to `shop.cart$` in `ngOnInit`, and `header/header.component.ts` subscribes to `cartCount$` in its constructor. No component implements `ngOnDestroy` or unsubscribes.
- **Why it hurts:** a fast change of route leaves the earlier request running, so a slow response can overwrite the newer page's data. Subscriptions to the long lived cart stream keep destroyed components alive and updating.
- **How the rewrite removes it:** server components fetch with `async` and `await`, so there is no stream to subscribe to, no request to cancel by hand and no subscription to leak.

## No `TransferState`, so every server rendered page fetches its data twice

- **Where:** `legacy/src/app/app.module.ts` imports `BrowserModule.withServerTransition` but no `BrowserTransferStateModule` or `TransferHttpCacheModule`, and `legacy/src/app/app.server.module.ts` adds no `ServerTransferStateModule`.
- **Why it hurts:** the server calls the backend to render the page, then the browser boots Angular and calls the backend again for the same data. One page view costs two backend calls, and the content can flicker if the second answer differs.
- **How the rewrite removes it:** React Server Components render with data fetched once on the server, and the browser receives the rendered result instead of fetching the data again.

## `isPlatformBrowser` and `isPlatformServer` checks scattered through the app

- **Where:** `legacy/src/app/shop.service.ts` checks `isPlatformBrowser` before touching `localStorage`, `legacy/src/app/api-url.interceptor.ts` checks `isPlatformServer` to point `/api` calls at the backend, and `legacy/src/app/checkout/cart-not-empty.guard.ts` checks `isPlatformBrowser` so the server never redirects an empty checkout.
- **Why it hurts:** whether code runs on the server or in the browser is decided case by case, deep inside a service, an interceptor and a route guard. It is easy to miss a case, and KD-04 is the result of one: the server never sees the cart.
- **How the rewrite removes it:** the App Router makes the boundary explicit (server components by default, client components marked as such), and the cart is kept where the server can read it, so the server rendered badge shows the real count.

## Prices handled as floating point dollars

- **Where:** `getSubtotal()`, `getShipping()` and `getTotal()` in `legacy/src/app/shop.service.ts` work in dollars (`priceCents / 100`, compared with `50`, adding `5.95`), and the templates `cart/cart.component.html`, `checkout/checkout.component.html`, `product-list/product-list.component.html`, `product-detail/product-detail.component.html` and `order-confirmation/order-confirmation.component.html` divide cents by 100 before formatting. The checkout template also adds subtotal and shipping itself.
- **Why it hurts:** binary floating point cannot represent most cent amounts exactly, so sums drift. The truncation in `getSubtotal()` turns that drift into a visible missing cent (KD-01).
- **How the rewrite removes it:** integer cents everywhere, as the backend already stores them, formatted only at the edge with `Intl.NumberFormat`.

## jQuery alongside Angular

- **Where:** `legacy/angular.json` loads `jquery.min.js` and `bootstrap.bundle.min.js` as global scripts on every page, from the `jquery` 3.5.1 and `bootstrap` 4.5.3 dependencies in `legacy/package.json`. Their only use is the mobile navigation toggle (`data-toggle="collapse"`) in `legacy/src/app/header/header.component.html`.
- **Why it hurts:** two libraries that both manipulate the DOM, one outside Angular's change detection, and a whole extra library shipped to every visitor for one collapsing menu.
- **How the rewrite removes it:** no jQuery and no Bootstrap JavaScript. Interactive behavior is React, and styling is Tailwind CSS.

## Old dependencies with known vulnerabilities

- **Where:** `legacy/package.json` pins Angular 10.2.5 and Angular Universal 10.1.0 (Angular 10 left long term support at the end of 2021), Express 4.17.3 and http-proxy-middleware 1.0.6, and `legacy/Dockerfile` runs Node 12.22.12, which reached end of life in April 2022. When this register was written, `npm audit --omit=dev` run with a current npm against `legacy/package-lock.json` reported 17 known vulnerabilities in production dependencies: 2 critical, 11 high, 1 moderate and 3 low. They include server side request forgery and header injection in `@nguniversal/express-engine`, cross site scripting and server side request forgery advisories across `@angular/*`, an open redirect and cross site scripting through `res.redirect` in Express, and denial of service in http-proxy-middleware.
- **Why it hurts:** the fixes ship only in newer major versions, and the toolchain is too old to take them without a migration of its own. Node 12 gets no security fixes at all.
- **How the rewrite removes it:** the latest stable Next.js and React on the current Node Active LTS, every dependency pinned exactly. The audit counts of both apps are compared in the results.

## Accessibility debt that leaves page structure unchanged

- **Where:**
  - Low contrast muted text: `legacy/src/styles.css` sets `.text-muted` to `#999`, a contrast ratio of about 2.8:1 on white against the 4.5:1 that WCAG AA asks for body text. It colors the stock status on the list and detail pages and the not found message.
  - Focus outlines removed: `legacy/src/styles.css` sets `outline: none` on focused links, buttons, inputs and selects, so keyboard users cannot see where they are.
  - Missing `lang` attribute: `legacy/src/index.html` opens with a bare `<html>`, so screen readers have to guess the language.
  - Missing image alt text: the product images in `legacy/src/app/product-list/product-list.component.html` and `legacy/src/app/product-detail/product-detail.component.html` have no `alt` attribute, so screen readers announce the file name or nothing useful.
- **Why it hurts:** each item shuts out or slows down people who use a keyboard, a screen reader or a low quality screen, and each costs points in an accessibility audit.
- **How the rewrite removes it:** a theme whose muted color passes contrast, visible focus styles, `lang="en"` on the document, `next/image` with the product name as alt text, and the jsx-a11y lint rules to keep it that way.
