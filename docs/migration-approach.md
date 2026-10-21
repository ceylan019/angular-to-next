# Migration approach

How the shop moved from Angular 10 to Next.js 16 without a big bang release, and why each step carried little risk. The legacy app here is a purpose-built stand-in, but nothing in the approach depends on that: it is the same sequence a real legacy app would go through.

In short: write down what the legacy app does, prove it with tests that do not care which app they run against, then replace the app flow by flow while those tests keep running against both. Every intended difference is recorded and tested. Any other change in behavior is a regression, and it fails the build.

## 1. Characterize the legacy app first

Before any Next.js code existed:

- Every business rule the shop must keep was written down with an ID in [requirements.md](./requirements.md): `BR-B` for browse, `BR-C` for cart and `BR-K` for checkout. Each rule lists the test layers that must cover it: legacy unit tests, web unit tests, backend tests and the shared suite.
- The shared Playwright suite in [`e2e/tests`](../e2e/tests) was written against the legacy app and proven green on it. At that point `ENABLED_NEXT_FLOWS` was empty, and the end to end job in CI ran the legacy project only.
- The suite finds elements by role, label and visible text, never by test IDs or CSS classes, so the same test runs unchanged against two code bases with different markup. The structure specs in [`e2e/tests/structure`](../e2e/tests/structure) compare ARIA snapshots of the header, the product list, the cart and the checkout, so a lost landmark, heading or label fails on either app.
- Every test starts from a reset database, through endpoints the backend serves only in test mode ([`backend/src/testing/test.routes.ts`](../backend/src/testing/test.routes.ts)). The suite runs one worker with no retries, so a flaky test fails the build instead of passing on a second try. A nightly job ([`flake-check.yml`](../.github/workflows/flake-check.yml)) repeats every test ten times against each app.

A suite that passes on the legacy app describes what the legacy app does today, defects included. That is the baseline the rewrite has to meet.

## 2. Enable the new app flow by flow

- Every shared spec file has a top level `test.describe`, and every top level title carries exactly one flow tag: `@shell`, `@browse`, `@cart` or `@checkout`. The traceability check fails a spec file that breaks either rule.
- `ENABLED_NEXT_FLOWS` in [`e2e/support/flows.ts`](../e2e/support/flows.ts) lists the flows the new app has taken over. [`e2e/playwright.config.ts`](../e2e/playwright.config.ts) turns that list into a `grep` for the `next` project. The `legacy` project always runs every test.
- Steps 5, 6 and 7 each rewrote part of the shop and added its flows to the list in the same pull request: shell and browse, then cart, then checkout. Before a flow is enabled, its tests do not run against the new app. Once it is enabled, they must pass on both apps, on x64 and Arm runners, for CI to pass.
- Tests added during the rewrite run against the legacy app too, so a new test cannot quietly describe only the new app.

The list now holds all four flows, so the whole suite runs against both apps on every pull request.

## 3. Record every difference

- [known-differences.md](./known-differences.md) lists each place where the legacy app breaks a rule. KD-01 to KD-05 were planted on purpose. KD-06 was not planted: the parity review of the cart rewrite found it. Each entry names the rule, the legacy behavior and the code behind it, the new behavior, and the tests on both sides.
- A shared test can expect different results per app only through `byTarget` in [`e2e/support/known-differences.ts`](../e2e/support/known-differences.ts). It takes a known difference ID and one expected value per app, and it adds the ID to the test's annotations in the Playwright report. For KD-03 the shared test expects a total of $55.95 on legacy and $50.00 on the new app.
- A shared test that names no known difference expects the same result on both apps. Any other difference fails it.
- The legacy unit tests that encode a known difference carry its ID as well, so the old behavior is pinned in two layers: in the legacy unit tests and in the shared suite.

Code level debt that changes no behavior, such as `any` types or the copy pasted shipping rule, is kept apart in [tech-debt.md](./tech-debt.md), so the register holds only differences a customer could notice.

## 4. Traceability is a CI gate

Test titles carry rule and known difference IDs in square brackets, for example `[BR-C5] [KD-03] ships free at exactly $50.00`. `pnpm traceability` ([`scripts/traceability`](../scripts/traceability)) reads every suite and writes [traceability.md](./traceability.md). It fails when:

- a rule has no test in a layer it lists (a rule's web tests become required once its flow is enabled),
- a known difference has no legacy test or no shared test,
- a test uses an ID that is not documented,
- a shared spec file has no top level `test.describe`, or a top level title does not carry exactly one flow tag.

The traceability job in [`ci.yml`](../.github/workflows/ci.yml) regenerates the matrix and fails on any difference from the committed file (`git diff --exit-code docs/traceability.md`), so the matrix in the repository always matches the tests.

## 5. Mutation testing checks the tests

Coverage shows that code ran during a test. It does not show that a test would notice if the code were wrong. Stryker makes small changes to the code, such as turning `>` into `>=`, and checks that at least one test fails for each change. KD-03 is that exact kind of defect: `>` where the rule says "at or above".

- The backend's core modules, the new app's feature and library modules, and the scripts behind traceability, metrics, results and the reports site fail CI when their mutation score drops below 90. The thresholds are in [`backend/stryker.config.json`](../backend/stryker.config.json), [`web/stryker.config.json`](../web/stryker.config.json) and [`scripts/stryker.config.json`](../scripts/stryker.config.json).
- The legacy app is mutation tested too, as a report without a threshold ([`legacy/stryker.conf.json`](../legacy/stryker.conf.json)). Its score sits next to the new app's in the results table.

## 6. Results come from CI

The `results` job in CI collects the Lighthouse, metrics, audit, mutation and coverage reports of one run, and `pnpm results` ([`scripts/results`](../scripts/results)) writes the results table in the README from them. Each pair measured on a running stack is measured for both apps on the same runner. A missing report shows as n/a with the reason, so every number in the table traces back to a report.

## Why each step was low risk

| Step                                      | What changed                                                      | Why the risk was low                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Repository skeleton                    | Workspace, Docker Compose and CI                                  | No behavior.                                                                                                                                                                                                                                                              |
| 2. Shared backend                         | One API and one database for both front ends                      | Both apps rely on the same server side rules, so the rewrite never changed how the backend prices orders, checks stock or takes payment. API tests run against a real PostgreSQL in a container. The backend's code did not change after this step.                       |
| 3. Legacy shop                            | The stand-in for the app being replaced                           | Its unit tests pin its behavior, planted defects included. Its application code did not change after this step.                                                                                                                                                           |
| 4. Shared suite, proven on legacy         | Tests and documentation only                                      | No application code changed. A green run proves the suite describes the legacy app as it is.                                                                                                                                                                              |
| 5 to 7. Rewrite browse, cart and checkout | One part of the new app per step, plus its flows in the flow list | A small surface per pull request. Each flow's shared tests must pass on both apps, and its rules need web unit tests before traceability passes. Any change that is not a recorded known difference fails the build.                                                      |
| 8. Old versus new results                 | Measurement, reporting and documentation                          | Tooling around the apps. The new app's changes in this step, for example a site icon, wrapping for long names and addresses on the confirmation page, and client bundle refactors of the error page and the product list controls, went through the same suite and gates. |

At every step the legacy app was whole and served every flow. Stopping the migration at any point would have left a working shop, and the way back was always the app that was already running.

## What the next stage adds

The parity work proves in CI that the new app behaves like the old one, apart from the recorded differences. The production rollout stage proves it with real traffic and keeps the way back open:

- **Traffic splitting.** A router in front of both apps sends a share of visitors to the new app. Each visitor stays on one app, because the legacy cart lives in `localStorage` and the new app's cart lives in a cookie, so a cart does not move between them.
- **Canary.** The share starts small and grows only while the new app's signals stay healthy.
- **Monitoring.** Error rates, latency and completed orders for each app, side by side, so a regression shows up as a difference between the two.
- **Instant rollback.** One switch sends all traffic back to the legacy app, which keeps running unchanged until the new app carries all of it.
- **Order access token.** The confirmation page stops relying on the order number alone, so knowing an order number is no longer enough to view the order.

This stage is tracked as a backlog issue.
