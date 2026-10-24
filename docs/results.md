# Results

Legacy is the Angular 10 app and New is the Next.js app, both running in their production containers against the same backend and the same data. Each pair measured on a running stack (Lighthouse, JavaScript on first load, backend calls) is measured for both apps on the same runner within one CI run.

| Metric                                               | Legacy                                                      | New                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| Lighthouse performance, `/`                          | 59                                                          | 100                                                         |
| Lighthouse performance, `/products/lavender-dusk`    | 81                                                          | 99                                                          |
| Lighthouse performance, `/cart`                      | 81                                                          | 99                                                          |
| Lighthouse accessibility, `/`                        | 86                                                          | 100                                                         |
| Lighthouse accessibility, `/products/lavender-dusk`  | 84                                                          | 100                                                         |
| Lighthouse accessibility, `/cart`                    | 89                                                          | 100                                                         |
| Lighthouse best practices, `/`                       | 100                                                         | 100                                                         |
| Lighthouse best practices, `/products/lavender-dusk` | 100                                                         | 100                                                         |
| Lighthouse best practices, `/cart`                   | 100                                                         | 100                                                         |
| Lighthouse SEO, `/`                                  | 83                                                          | 100                                                         |
| Lighthouse SEO, `/products/lavender-dusk`            | 83                                                          | 100                                                         |
| Lighthouse SEO, `/cart`                              | 91                                                          | 100                                                         |
| JavaScript on first load, `/` (KB, gzip)             | 147.3                                                       | 143.6                                                       |
| Backend calls per product page view                  | 2                                                           | 1                                                           |
| Known vulnerabilities (production dependencies)      | 52 (2 critical, 31 high, 13 moderate, 6 low)                | 0                                                           |
| Mutation score                                       | 96.1% (788 killed, 1 timed out, 32 survived, 0 not covered) | 98.6% (702 killed, 2 timed out, 10 survived, 0 not covered) |
| Line coverage                                        | 100%                                                        | 96.07%                                                      |

Line coverage scopes differ: Karma instruments only the legacy files the specs load, while Vitest V8 reports every file under the new app's `src`.

A cell reads n/a when its report is missing or unreadable in this run, with the reason in parentheses.

## How each number is measured

- Lighthouse: the median score of 5 mobile runs per page, out of 100.
- JavaScript on first load: the sum of the gzip sizes of each script response body on `/` until the load event, each URL counted once, compressed by the measuring script with zlib for both apps, because the legacy server does not compress its responses and wire sizes would not compare. Scripts inlined in the HTML are part of the document and not counted. The `metrics` artifact lists each script URL with its gzip size. 1 KB is 1024 bytes.
- Backend calls: the API requests the backend counts while a fresh browser loads `/products/lavender-dusk` until the network is idle, server rendering included. The backend's own health and test endpoints are not counted, and the front end health checks load `/cart`, which calls no API.
- Known vulnerabilities: the advisories reported by `npm audit --production` with npm 6 for legacy and by `pnpm audit --prod` for the new app, each advisory counted once by severity (critical, high, moderate, low) rather than the per path totals in the audit metadata.
- Mutation score: detected mutants (killed or timed out) over valid mutants (killed, timed out, survived or not covered), to one decimal. Timeouts are listed next to the score because a loaded machine can turn a timeout into a false kill. The shared backend is mutation tested too and is not a column here.
- Legacy mutation testing runs Stryker 5.6.1 on Node 12, with its dependencies resolved as published before 2025-08-01 (which holds `inquirer` at 8.2.6) and `procps` in the mutation image. Refreshing the legacy lockfile with plain npm 6 breaks it.
- Line coverage: `total.lines.pct` from each app's coverage summary, from Karma with Istanbul for legacy and Vitest with V8 for the new app.

Numbers come from CI run [https://github.com/ceylan019/angular-to-next/actions/runs/40064179046](https://github.com/ceylan019/angular-to-next/actions/runs/40064179046), not from a developer machine.
