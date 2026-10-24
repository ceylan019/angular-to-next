import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "prettier";
import { describe, expect, it } from "vitest";
import { ReportError } from "../metrics/audit.ts";
import {
  buildReadmeSection,
  buildResults,
  countMutants,
  lighthouseScore,
  lineCoverage,
  mutationScore,
  readInput,
  replaceReadmeSection,
  runUrlFrom,
  USAGE,
  type Category,
  type ResultsInput,
  type SideReports,
} from "./results.ts";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", name), "utf8"));

const RUN = "https://github.com/owner/shop/actions/runs/123";
const PRODUCT = "/products/lavender-dusk";

const expectError = (read: () => unknown, reason: string): void => {
  expect(read).toThrow(ReportError);
  expect(read).toThrow(new ReportError(reason));
};

const expectUnreadable = (read: () => unknown): void => {
  expectError(read, "report unreadable");
};

const times = <T>(count: number, value: T): T[] =>
  Array.from({ length: count }, () => value);

const mutationReport = (...statuses: string[]): unknown => ({
  schemaVersion: "1.0",
  thresholds: { high: 80, low: 60 },
  files: {
    "src/a.ts": {
      language: "typescript",
      source: "export const a = 1;\n",
      mutants: statuses.map((status, index) => ({
        id: String(index),
        mutatorName: "BooleanLiteral",
        replacement: "false",
        location: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
        status,
      })),
    },
  },
});

type Summary = Partial<Record<Category, number | null>>;

const manifest = (
  runs: Record<string, Record<string, unknown>[]>,
  origin = "http://localhost:3000",
): unknown[] =>
  Object.entries(runs).flatMap(([page, summaries]) =>
    summaries.map((summary) => ({
      url: `${origin}${page}`,
      isRepresentativeRun: false,
      htmlPath: "/tmp/report.html",
      jsonPath: "/tmp/report.json",
      summary,
    })),
  );

const scores = (performance: number): Summary => ({
  performance,
  accessibility: 1,
  "best-practices": 1,
  seo: 1,
});

const coverage = (pct: unknown): unknown => ({
  total: { lines: { total: 10, covered: 9, skipped: 0, pct } },
});

const METRICS = {
  legacy: {
    jsBytes: 307_200,
    backendCalls: 2,
    scripts: [{ url: "http://localhost:4000/main.js", gzipBytes: 307_200 }],
  },
  next: {
    jsBytes: 153_600,
    backendCalls: 1,
    scripts: [
      { url: "http://localhost:3000/_next/a.js", gzipBytes: 100_000 },
      { url: "http://localhost:3000/_next/b.js", gzipBytes: 53_600 },
    ],
  },
};

const NEXT_MUTATION = mutationReport(
  ...times(701, "Killed"),
  ...times(2, "Timeout"),
  ...times(10, "Survived"),
);

const MISSING: SideReports = {
  lighthouse: undefined,
  audit: undefined,
  mutation: undefined,
  coverage: undefined,
};

const input = (
  overrides: {
    metrics?: unknown;
    legacy?: Partial<SideReports>;
    next?: Partial<SideReports>;
  } = {},
): ResultsInput => ({
  runUrl: RUN,
  metrics: "metrics" in overrides ? overrides.metrics : METRICS,
  legacy: {
    lighthouse: fixture("lighthouse-manifest.json"),
    audit: fixture("npm6-audit.json"),
    mutation: fixture("mutation.json"),
    coverage: fixture("coverage-summary.json"),
    ...overrides.legacy,
  },
  next: {
    lighthouse: manifest({
      "/": times(5, scores(0.97)),
      [PRODUCT]: times(5, scores(0.99)),
      "/cart": [
        scores(0.98),
        scores(0.97),
        { ...scores(0.99), accessibility: 0.95 },
        scores(0.96),
        scores(1),
      ],
    }),
    audit: fixture("pnpm-audit.json"),
    mutation: NEXT_MUTATION,
    coverage: coverage(99.5),
    ...overrides.next,
  },
});

const tableLines = (markdown: string): string[] =>
  markdown.split("\n").filter((line) => line.startsWith("|"));

const cellsOf = (line: string): string[] =>
  line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());

const labels = (markdown: string): string[] =>
  tableLines(markdown)
    .slice(2)
    .map((line) => cellsOf(line)[0] ?? "");

const row = (markdown: string, label: string): string[] | undefined =>
  tableLines(markdown)
    .map(cellsOf)
    .find((cells) => cells[0] === label)
    ?.slice(1);

const LABELS = [
  "Lighthouse performance, `/`",
  "Lighthouse performance, `/products/lavender-dusk`",
  "Lighthouse performance, `/cart`",
  "Lighthouse accessibility, `/`",
  "Lighthouse accessibility, `/products/lavender-dusk`",
  "Lighthouse accessibility, `/cart`",
  "Lighthouse best practices, `/`",
  "Lighthouse best practices, `/products/lavender-dusk`",
  "Lighthouse best practices, `/cart`",
  "Lighthouse SEO, `/`",
  "Lighthouse SEO, `/products/lavender-dusk`",
  "Lighthouse SEO, `/cart`",
  "JavaScript on first load, `/` (KB, gzip)",
  "Backend calls per product page view",
  "Known vulnerabilities (production dependencies)",
  "Mutation score",
  "Line coverage",
];

const JS_ROW = "JavaScript on first load, `/` (KB, gzip)";
const CALLS_ROW = "Backend calls per product page view";
const AUDIT_ROW = "Known vulnerabilities (production dependencies)";

const METHOD = [
  "## How each number is measured",
  "",
  "- Lighthouse: the median score of 5 mobile runs per page, out of 100.",
  "- JavaScript on first load: the sum of the gzip sizes of each script response body on `/` until the load event, each URL counted once, compressed by the measuring script with zlib for both apps, because the legacy server does not compress its responses and wire sizes would not compare. Scripts inlined in the HTML are part of the document and not counted. The `metrics` artifact lists each script URL with its gzip size. 1 KB is 1024 bytes.",
  "- Backend calls: the API requests the backend counts while a fresh browser loads `/products/lavender-dusk` until the network is idle, server rendering included. The backend's own health and test endpoints are not counted, and the front end health checks load `/cart`, which calls no API.",
  "- Known vulnerabilities: the advisories reported by `npm audit --production` with npm 6 for legacy and by `pnpm audit --prod` for the new app, each advisory counted once by severity (critical, high, moderate, low) rather than the per path totals in the audit metadata.",
  "- Mutation score: detected mutants (killed or timed out) over valid mutants (killed, timed out, survived or not covered), to one decimal. Timeouts are listed next to the score because a loaded machine can turn a timeout into a false kill. The shared backend is mutation tested too and is not a column here.",
  "- Legacy mutation testing runs Stryker 5.6.1 on Node 12, with its dependencies resolved as published before 2025-08-01 (which holds `inquirer` at 8.2.6) and `procps` in the mutation image. Refreshing the legacy lockfile with plain npm 6 breaks it.",
  "- Line coverage: `total.lines.pct` from each app's coverage summary, from Karma with Istanbul for legacy and Vitest with V8 for the new app.",
].join("\n");

const INTRO =
  "Legacy is the Angular 10 app and New is the Next.js app, both running in their production containers against the same backend and the same data. Each pair measured on a running stack (Lighthouse, JavaScript on first load, backend calls) is measured for both apps on the same runner within one CI run.";
const COVERAGE_NOTE =
  "Line coverage scopes differ: Karma instruments only the legacy files the specs load, while Vitest V8 reports every file under the new app's `src`.";
const NA_NOTE =
  "A cell reads n/a when its report is missing or unreadable in this run, with the reason in parentheses.";
const LEGACY_MUTATION_NOTE =
  "The legacy mutation score is unavailable for this run because the `mutation-legacy` artifact is missing.";
const FOOTER = `Numbers come from CI run [${RUN}](${RUN}), not from a developer machine.`;
const DETAILS =
  "How each number is measured: [docs/results.md](docs/results.md).";

describe("countMutants", () => {
  it("counts the statuses of a Stryker report", () => {
    expect(countMutants(fixture("mutation.json"))).toEqual({
      killed: 8,
      timeout: 1,
      survived: 1,
      noCoverage: 0,
    });
  });

  it("adds up mutants across files", () => {
    const report = {
      files: {
        "a.ts": { mutants: [{ status: "Killed" }, { status: "NoCoverage" }] },
        "b.ts": { mutants: [{ status: "Survived" }, { status: "Timeout" }] },
        "c.ts": { mutants: [{ status: "Killed" }, { status: "NoCoverage" }] },
      },
    };

    expect(countMutants(report)).toEqual({
      killed: 2,
      timeout: 1,
      survived: 1,
      noCoverage: 2,
    });
  });

  it("leaves out compile errors, runtime errors, ignored and pending mutants", () => {
    expect(
      countMutants(
        mutationReport(
          "CompileError",
          "RuntimeError",
          "Ignored",
          "Pending",
          "Killed",
        ),
      ),
    ).toEqual({ killed: 1, timeout: 0, survived: 0, noCoverage: 0 });
  });

  it("counts a report without files as zero", () => {
    expect(countMutants({ files: {} })).toEqual({
      killed: 0,
      timeout: 0,
      survived: 0,
      noCoverage: 0,
    });
  });

  it.each([
    ["null", null],
    ["a string", "report"],
    ["an array", []],
    ["a report without files", { schemaVersion: "1.0" }],
    ["null files", { files: null }],
    ["files as an array", { files: [] }],
    ["a null file", { files: { "a.ts": null } }],
    ["a file without mutants", { files: { "a.ts": { source: "" } } }],
    ["mutants that are not a list", { files: { "a.ts": { mutants: {} } } }],
    ["a null mutant", { files: { "a.ts": { mutants: [null] } } }],
    ["a mutant without a status", { files: { "a.ts": { mutants: [{}] } } }],
    [
      "a status that is not a string",
      { files: { "a.ts": { mutants: [{ status: 1 }] } } },
    ],
    ["an unknown status", mutationReport("Killed", "Exploded")],
    ["a status in the wrong case", mutationReport("killed")],
  ])("rejects %s", (_name, report) => {
    expectUnreadable(() => countMutants(report));
  });
});

describe("mutationScore", () => {
  it("computes the mutation score", () => {
    expect(mutationScore(fixture("mutation.json"))).toBe(90);
  });

  it("counts timeouts as detected", () => {
    expect(mutationScore(mutationReport("Timeout"))).toBe(100);
    expect(mutationScore(mutationReport("Timeout", "Survived"))).toBe(50);
  });

  it("counts mutants without coverage as undetected", () => {
    expect(mutationScore(mutationReport("Killed", "NoCoverage"))).toBe(50);
    expect(mutationScore(mutationReport("NoCoverage"))).toBe(0);
  });

  it("rounds to one decimal", () => {
    expect(mutationScore(mutationReport("Killed", "Killed", "Survived"))).toBe(
      66.7,
    );
    expect(
      mutationScore(mutationReport("Killed", "Survived", "Survived")),
    ).toBe(33.3);
    expect(mutationScore(NEXT_MUTATION)).toBe(98.6);
  });

  it("leaves out mutants that are not valid", () => {
    expect(
      mutationScore(
        mutationReport(
          "Killed",
          "Survived",
          "CompileError",
          "RuntimeError",
          "Ignored",
          "Pending",
        ),
      ),
    ).toBe(50);
  });

  it("refuses a score without valid mutants", () => {
    expectError(() => mutationScore({ files: {} }), "no valid mutants");
    expectError(
      () => mutationScore(mutationReport("Ignored", "CompileError")),
      "no valid mutants",
    );
  });

  it("rejects a report that is not a Stryker report", () => {
    expectUnreadable(() => mutationScore(null));
    expectUnreadable(() => mutationScore({ files: { "a.ts": {} } }));
  });
});

describe("lighthouseScore", () => {
  const legacy = fixture("lighthouse-manifest.json");

  it("takes the median of the runs for each page and category", () => {
    expect(lighthouseScore(legacy, "/", "performance")).toBe(59);
    expect(lighthouseScore(legacy, PRODUCT, "performance")).toBe(82);
    expect(lighthouseScore(legacy, "/cart", "performance")).toBe(84);
    expect(lighthouseScore(legacy, "/", "accessibility")).toBe(86);
    expect(lighthouseScore(legacy, "/cart", "accessibility")).toBe(89);
    expect(lighthouseScore(legacy, "/cart", "best-practices")).toBe(100);
    expect(lighthouseScore(legacy, PRODUCT, "seo")).toBe(83);
    expect(lighthouseScore(legacy, "/cart", "seo")).toBe(91);
  });

  it("averages the two middle runs of an even number of runs", () => {
    const runs = manifest({
      "/": [scores(0.5), scores(0.9), scores(0.7), scores(0.6)],
    });

    expect(lighthouseScore(runs, "/", "performance")).toBe(65);
  });

  it("uses a single run as it is", () => {
    expect(
      lighthouseScore(manifest({ "/": [scores(0.42)] }), "/", "performance"),
    ).toBe(42);
  });

  it("sorts scores by value before taking the middle", () => {
    const runs = manifest({
      "/": [scores(1), scores(0.2), scores(0.05), scores(0.9), scores(0.1)],
    });

    expect(lighthouseScore(runs, "/", "performance")).toBe(20);
  });

  it("rounds the median to a whole score", () => {
    expect(
      lighthouseScore(
        manifest({ "/": [scores(0.5), scores(0.535)] }),
        "/",
        "performance",
      ),
    ).toBe(52);
    expect(
      lighthouseScore(
        manifest({ "/": [scores(0.5), scores(0.505)] }),
        "/",
        "performance",
      ),
    ).toBe(50);
  });

  it("skips runs without a score for the category", () => {
    const runs = manifest({
      "/": [{ performance: null }, scores(0.8), { seo: 1 }],
    });

    expect(lighthouseScore(runs, "/", "performance")).toBe(80);
  });

  it("matches runs by page path on the origin they share and ignores other pages", () => {
    const runs = manifest(
      {
        "/": [scores(0.3)],
        "/cart": [scores(0.9)],
        [PRODUCT]: [scores(0.7)],
      },
      "http://127.0.0.1:3002",
    );

    expect(lighthouseScore(runs, "/", "performance")).toBe(30);
    expect(lighthouseScore(runs, "/cart", "performance")).toBe(90);
    expect(lighthouseScore(runs, PRODUCT, "performance")).toBe(70);
  });

  it("refuses runs that span more than one origin", () => {
    const runs = [
      ...manifest({ "/": [scores(0.3)] }, "http://localhost:4000"),
      ...manifest({ "/": [scores(0.9)] }, "http://localhost:3000"),
    ];

    expectError(
      () => lighthouseScore(runs, "/", "performance"),
      "runs from more than one origin",
    );
    expectError(
      () =>
        lighthouseScore(
          [
            ...manifest({ "/cart": [scores(1)] }, "http://localhost:3000"),
            ...manifest({ "/cart": [scores(1)] }, "https://localhost:3000"),
          ],
          "/",
          "seo",
        ),
      "runs from more than one origin",
    );
  });

  it("refuses a page without scored runs", () => {
    expectError(() => lighthouseScore([], "/", "seo"), "no scored runs");
    expectError(
      () => lighthouseScore(manifest({ "/cart": [scores(1)] }), "/", "seo"),
      "no scored runs",
    );
    expectError(
      () =>
        lighthouseScore(
          manifest({ "/": [{ seo: null }, { performance: 1 }] }),
          "/",
          "seo",
        ),
      "no scored runs",
    );
  });

  it.each([
    ["null", null],
    ["an object", { url: "http://localhost/" }],
    ["a null run", [null]],
    ["a run as an array", [[]]],
    ["a run without a url", [{ summary: scores(1) }]],
    ["a url that is not a string", [{ url: 3, summary: scores(1) }]],
    ["a url that does not parse", [{ url: "not a url", summary: scores(1) }]],
    [
      "a url inside a list",
      [{ url: ["http://localhost/"], summary: scores(1) }],
    ],
    ["a run without a summary", [{ url: "http://localhost/" }]],
    ["a null summary", [{ url: "http://localhost/", summary: null }]],
    ["a summary as an array", [{ url: "http://localhost/", summary: [] }]],
    ["a score as a string", manifest({ "/": [{ performance: "0.9" }] })],
    ["a score above one", manifest({ "/": [scores(1.01)] })],
    ["a score below zero", manifest({ "/": [scores(-0.01)] })],
    ["a score that is not a number", manifest({ "/": [scores(Number.NaN)] })],
  ])("rejects %s", (_name, value) => {
    expectUnreadable(() => lighthouseScore(value, "/", "performance"));
  });

  it("accepts the lowest and highest scores", () => {
    expect(
      lighthouseScore(manifest({ "/": [scores(0)] }), "/", "performance"),
    ).toBe(0);
    expect(
      lighthouseScore(manifest({ "/": [scores(1)] }), "/", "performance"),
    ).toBe(100);
  });
});

describe("lineCoverage", () => {
  it("reads the total line coverage of a coverage summary", () => {
    expect(lineCoverage(fixture("coverage-summary.json"))).toBe(91.25);
  });

  it("accepts no and full coverage", () => {
    expect(lineCoverage(coverage(0))).toBe(0);
    expect(lineCoverage(coverage(100))).toBe(100);
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["a summary without a total", {}],
    ["a null total", { total: null }],
    ["a total without lines", { total: { statements: {} } }],
    ["null lines", { total: { lines: null } }],
    ["lines without a percentage", { total: { lines: { total: 1 } } }],
    ["an unknown percentage", coverage("Unknown")],
    ["a percentage as a string", coverage("91.25")],
    ["a null percentage", coverage(null)],
    ["a percentage below zero", coverage(-0.01)],
    ["a percentage above 100", coverage(100.01)],
    ["a percentage that is not a number", coverage(Number.NaN)],
  ])("rejects %s", (_name, value) => {
    expectUnreadable(() => lineCoverage(value));
  });
});

describe("buildResults", () => {
  it("renders the results table with both columns and the run link", () => {
    const markdown = buildResults(input());

    expect(cellsOf(tableLines(markdown)[0] ?? "")).toEqual([
      "Metric",
      "Legacy",
      "New",
    ]);
    expect(labels(markdown)).toEqual(LABELS);
    expect(row(markdown, "Lighthouse performance, `/`")).toEqual(["59", "97"]);
    expect(row(markdown, `Lighthouse performance, \`${PRODUCT}\``)).toEqual([
      "82",
      "99",
    ]);
    expect(row(markdown, "Lighthouse performance, `/cart`")).toEqual([
      "84",
      "98",
    ]);
    expect(row(markdown, "Lighthouse accessibility, `/`")).toEqual([
      "86",
      "100",
    ]);
    expect(row(markdown, `Lighthouse accessibility, \`${PRODUCT}\``)).toEqual([
      "84",
      "100",
    ]);
    expect(row(markdown, "Lighthouse accessibility, `/cart`")).toEqual([
      "89",
      "100",
    ]);
    expect(row(markdown, "Lighthouse best practices, `/`")).toEqual([
      "100",
      "100",
    ]);
    expect(row(markdown, `Lighthouse best practices, \`${PRODUCT}\``)).toEqual([
      "100",
      "100",
    ]);
    expect(row(markdown, "Lighthouse best practices, `/cart`")).toEqual([
      "100",
      "100",
    ]);
    expect(row(markdown, "Lighthouse SEO, `/`")).toEqual(["83", "100"]);
    expect(row(markdown, `Lighthouse SEO, \`${PRODUCT}\``)).toEqual([
      "83",
      "100",
    ]);
    expect(row(markdown, "Lighthouse SEO, `/cart`")).toEqual(["91", "100"]);
    expect(row(markdown, JS_ROW)).toEqual(["300.0", "150.0"]);
    expect(row(markdown, CALLS_ROW)).toEqual(["2", "1"]);
    expect(row(markdown, AUDIT_ROW)).toEqual([
      "11 (2 critical, 5 high, 3 moderate, 1 low)",
      "3 (0 critical, 0 high, 1 moderate, 2 low)",
    ]);
    expect(row(markdown, "Mutation score")).toEqual([
      "90.0% (8 killed, 1 timed out, 1 survived, 0 not covered)",
      "98.6% (701 killed, 2 timed out, 10 survived, 0 not covered)",
    ]);
    expect(row(markdown, "Line coverage")).toEqual(["91.25%", "99.5%"]);
    expect(markdown).toContain(FOOTER);
  });

  it("lays out the document around the table", () => {
    const markdown = buildResults(input());
    const table = tableLines(markdown).join("\n");

    expect(markdown).toBe(
      [
        "# Results",
        "",
        INTRO,
        "",
        table,
        "",
        COVERAGE_NOTE,
        "",
        NA_NOTE,
        "",
        METHOD,
        "",
        FOOTER,
        "",
      ].join("\n"),
    );
  });

  it("notes when legacy mutation is unavailable", () => {
    const markdown = buildResults(input({ legacy: { mutation: undefined } }));

    expect(row(markdown, "Mutation score")).toEqual([
      "n/a (report missing)",
      "98.6% (701 killed, 2 timed out, 10 survived, 0 not covered)",
    ]);
    expect(markdown).toContain(`${NA_NOTE}\n\n${LEGACY_MUTATION_NOTE}\n\n`);
  });

  it("leaves the unavailable note out when the legacy mutation report exists", () => {
    expect(buildResults(input())).not.toContain(LEGACY_MUTATION_NOTE);
    expect(
      buildResults(input({ legacy: { mutation: { files: null } } })),
    ).not.toContain(LEGACY_MUTATION_NOTE);
    expect(
      buildResults(input({ next: { mutation: undefined } })),
    ).not.toContain(LEGACY_MUTATION_NOTE);
  });

  it("renders n/a with a reason for every missing report", () => {
    const markdown = buildResults({
      runUrl: RUN,
      metrics: undefined,
      legacy: MISSING,
      next: MISSING,
    });

    expect(labels(markdown)).toEqual(LABELS);
    for (const label of LABELS) {
      expect(row(markdown, label)).toEqual([
        "n/a (report missing)",
        "n/a (report missing)",
      ]);
    }
    expect(markdown).toContain(LEGACY_MUTATION_NOTE);
    expect(markdown).toContain(FOOTER);
  });

  it("renders n/a for unreadable reports", () => {
    const junk: SideReports = {
      lighthouse: null,
      audit: "audit",
      mutation: [],
      coverage: { total: null },
    };
    const markdown = buildResults({
      runUrl: RUN,
      metrics: null,
      legacy: junk,
      next: junk,
    });

    for (const label of LABELS) {
      expect(row(markdown, label)).toEqual([
        "n/a (report unreadable)",
        "n/a (report unreadable)",
      ]);
    }
  });

  it("names the reason when Lighthouse runs mix origins", () => {
    const markdown = buildResults(
      input({
        legacy: {
          lighthouse: [
            ...manifest({ "/": [scores(0.5)] }, "http://localhost:4000"),
            ...manifest({ "/": [scores(0.6)] }, "http://localhost:3000"),
          ],
        },
      }),
    );

    expect(row(markdown, "Lighthouse SEO, `/cart`")).toEqual([
      "n/a (runs from more than one origin)",
      "100",
    ]);
  });

  it("names the reason when a report has nothing to score", () => {
    const markdown = buildResults(
      input({
        legacy: {
          lighthouse: manifest({ "/cart": [scores(0.5)] }),
          mutation: { files: {} },
        },
      }),
    );

    expect(row(markdown, "Lighthouse performance, `/`")).toEqual([
      "n/a (no scored runs)",
      "97",
    ]);
    expect(row(markdown, "Lighthouse performance, `/cart`")).toEqual([
      "50",
      "98",
    ]);
    expect(row(markdown, "Mutation score")?.[0]).toBe("n/a (no valid mutants)");
  });

  it("lets an unexpected error through instead of hiding it as n/a", () => {
    const metrics = {
      get legacy(): never {
        throw new TypeError("broken getter");
      },
    };

    expect(() => buildResults(input({ metrics }))).toThrow(
      new TypeError("broken getter"),
    );
  });

  it("reads the measured metrics of each app on its own", () => {
    const markdown = buildResults(
      input({ metrics: { legacy: METRICS.legacy, next: { jsBytes: 1024 } } }),
    );

    expect(row(markdown, JS_ROW)).toEqual(["300.0", "1.0"]);
    expect(row(markdown, CALLS_ROW)).toEqual(["2", "n/a (report unreadable)"]);
  });

  it("rejects a metrics report that is not an object", () => {
    for (const metrics of [[], "metrics", 3]) {
      const markdown = buildResults(input({ metrics }));

      expect(row(markdown, JS_ROW)).toEqual([
        "n/a (report unreadable)",
        "n/a (report unreadable)",
      ]);
      expect(row(markdown, CALLS_ROW)).toEqual([
        "n/a (report unreadable)",
        "n/a (report unreadable)",
      ]);
    }
  });

  it.each([
    ["a metrics report without the app", { next: METRICS.next }],
    ["a null app", { legacy: null, next: METRICS.next }],
    ["an app as an array", { legacy: [], next: METRICS.next }],
    [
      "counts that are not whole numbers of zero or more",
      { legacy: { jsBytes: -1, backendCalls: 1.5 }, next: METRICS.next },
    ],
    [
      "counts as strings",
      { legacy: { jsBytes: "1", backendCalls: "2" }, next: METRICS.next },
    ],
  ])("rejects %s", (_name, metrics) => {
    const markdown = buildResults(input({ metrics }));

    expect(row(markdown, JS_ROW)).toEqual(["n/a (report unreadable)", "150.0"]);
    expect(row(markdown, CALLS_ROW)).toEqual(["n/a (report unreadable)", "1"]);
  });

  it("shows script sizes in KB of 1024 bytes to one decimal", () => {
    const sizes = (legacy: number, next: number) =>
      row(
        buildResults(
          input({
            metrics: {
              legacy: { jsBytes: legacy, backendCalls: 0 },
              next: { jsBytes: next, backendCalls: 0 },
            },
          }),
        ),
        JS_ROW,
      );

    expect(sizes(0, 1536)).toEqual(["0.0", "1.5"]);
    expect(sizes(1075, 1076)).toEqual(["1.0", "1.1"]);
  });

  it("shows zero backend calls", () => {
    const markdown = buildResults(
      input({
        metrics: {
          legacy: { jsBytes: 0, backendCalls: 0 },
          next: METRICS.next,
        },
      }),
    );

    expect(row(markdown, CALLS_ROW)).toEqual(["0", "1"]);
  });

  it("shows a clean audit as a plain zero", () => {
    const clean = {
      advisories: { "7": { id: 7, severity: "info" } },
      metadata: {
        vulnerabilities: { info: 1, low: 0, moderate: 0, high: 0, critical: 0 },
      },
    };

    expect(
      row(buildResults(input({ next: { audit: clean } })), AUDIT_ROW),
    ).toEqual(["11 (2 critical, 5 high, 3 moderate, 1 low)", "0"]);
  });

  it("aligns every table column", () => {
    const lines = tableLines(buildResults(input({ next: MISSING })));
    const pipes = (line: string): number[] =>
      Array.from(line.matchAll(/\|/g), (match) => match.index);

    expect(lines).toHaveLength(LABELS.length + 2);
    expect(new Set(lines.map((line) => pipes(line).join())).size).toBe(1);
    expect(lines[1]).toMatch(/^\| -+ \| -+ \| -+ \|$/);
  });
});

describe("buildReadmeSection", () => {
  it("renders the table with links to the details and the run", () => {
    const section = buildReadmeSection(input());
    const table = tableLines(buildResults(input())).join("\n");

    expect(section).toBe(
      `${table}\n\n${COVERAGE_NOTE}\n\n${DETAILS} ${FOOTER}`,
    );
  });

  it("carries the same n/a cells as the results document", () => {
    const missing = input({ legacy: MISSING });

    expect(tableLines(buildReadmeSection(missing))).toEqual(
      tableLines(buildResults(missing)),
    );
  });
});

describe("markdown formatting", () => {
  const README = [
    "# Shop",
    "",
    "Intro.",
    "",
    "## Status",
    "",
    "- [x] Step 1",
    "",
  ].join("\n");

  it("renders markdown that the formatter leaves unchanged", async () => {
    const documents = [
      buildResults(input()),
      buildResults(input({ legacy: { mutation: undefined } })),
      buildResults({
        runUrl: RUN,
        metrics: undefined,
        legacy: MISSING,
        next: MISSING,
      }),
      replaceReadmeSection(README, "Results", buildReadmeSection(input())),
    ];

    for (const markdown of documents) {
      expect(await format(markdown, { parser: "markdown" })).toBe(markdown);
    }
  });
});

describe("replaceReadmeSection", () => {
  const lines = (...text: string[]): string => text.join("\n");

  it("replaces only the results section of the README", () => {
    const readme = lines(
      "# Shop",
      "",
      "Intro.",
      "",
      "## Results",
      "",
      "Old table.",
      "",
      "### Old detail",
      "",
      "Old text.",
      "",
      "## Status",
      "",
      "- [x] Step 1",
      "",
    );

    expect(replaceReadmeSection(readme, "Results", "New table.")).toBe(
      lines(
        "# Shop",
        "",
        "Intro.",
        "",
        "## Results",
        "",
        "New table.",
        "",
        "## Status",
        "",
        "- [x] Step 1",
        "",
      ),
    );
  });

  it("adds a results section when none exists", () => {
    const readme = lines("# Shop", "", "## Status", "", "- [x] Step 1", "");

    expect(replaceReadmeSection(readme, "Results", "New table.")).toBe(
      lines(
        "# Shop",
        "",
        "## Status",
        "",
        "- [x] Step 1",
        "",
        "## Results",
        "",
        "New table.",
        "",
      ),
    );
  });

  it("replaces a last section up to the end of the file", () => {
    const readme = lines("# Shop", "", "## Results", "", "Old.", "", "", "");

    expect(replaceReadmeSection(readme, "Results", "New.")).toBe(
      lines("# Shop", "", "## Results", "", "New.", ""),
    );
  });

  it("ends the section at a top level heading", () => {
    const readme = lines("## Results", "", "Old.", "# Appendix", "", "A.", "");

    expect(replaceReadmeSection(readme, "Results", "New.")).toBe(
      lines("## Results", "", "New.", "", "# Appendix", "", "A.", ""),
    );
  });

  it("puts one blank line between the section and its neighbours", () => {
    expect(
      replaceReadmeSection(
        lines("Intro.", "## Results", "Old.", "## Status", "Done."),
        "Results",
        "New.",
      ),
    ).toBe(
      lines(
        "Intro.",
        "",
        "## Results",
        "",
        "New.",
        "",
        "## Status",
        "Done.",
        "",
      ),
    );
  });

  it("trims blank lines around the body and keeps its inner lines", () => {
    expect(
      replaceReadmeSection(
        lines("## Results", "", "Old.", ""),
        "Results",
        "\n\nFirst.\n\nSecond.\n\n",
      ),
    ).toBe(lines("## Results", "", "First.", "", "Second.", ""));
  });

  it("matches the heading line exactly, apart from trailing spaces", () => {
    expect(
      replaceReadmeSection(
        lines("# Shop", "", "## Results  ", "", "Old.", ""),
        "Results",
        "New.",
      ),
    ).toBe(lines("# Shop", "", "## Results", "", "New.", ""));
    for (const heading of [
      "## Results archive",
      "### Results",
      "##  Results",
    ]) {
      expect(
        replaceReadmeSection(
          lines(heading, "", "Kept.", ""),
          "Results",
          "New.",
        ),
      ).toBe(lines(heading, "", "Kept.", "", "## Results", "", "New.", ""));
    }
  });

  it("uses the heading it is given", () => {
    expect(
      replaceReadmeSection(
        lines("## Numbers", "", "Old.", "", "## Results", "", "Kept.", ""),
        "Numbers",
        "New.",
      ),
    ).toBe(lines("## Numbers", "", "New.", "", "## Results", "", "Kept.", ""));
  });

  it("gives the same README when run twice", () => {
    const readme = lines("# Shop", "", "## Status", "", "Done.", "");
    const once = replaceReadmeSection(readme, "Results", "Table.");

    expect(replaceReadmeSection(once, "Results", "Table.")).toBe(once);
  });

  it("appends to a README without a final newline or content", () => {
    expect(replaceReadmeSection("# Shop", "Results", "New.")).toBe(
      lines("# Shop", "", "## Results", "", "New.", ""),
    );
    expect(replaceReadmeSection("", "Results", "New.")).toBe(
      lines("## Results", "", "New.", ""),
    );
    expect(replaceReadmeSection("\n\n", "Results", "New.")).toBe(
      lines("## Results", "", "New.", ""),
    );
  });

  it("replaces trailing content up to the end of the file when no heading follows", () => {
    const readme = lines(
      "# Shop",
      "",
      "## Results",
      "",
      "Old table.",
      "",
      "Old note.",
      "",
      "```",
      "old code",
      "```",
      "",
    );

    expect(replaceReadmeSection(readme, "Results", "New.")).toBe(
      lines("# Shop", "", "## Results", "", "New.", ""),
    );
  });

  it("ignores a results heading inside a fenced code block", () => {
    const readme = lines("# Shop", "", "```md", "## Results", "```", "");

    expect(replaceReadmeSection(readme, "Results", "New.")).toBe(
      lines(
        "# Shop",
        "",
        "```md",
        "## Results",
        "```",
        "",
        "## Results",
        "",
        "New.",
        "",
      ),
    );
  });

  it("keeps fenced lines that look like headings inside the section", () => {
    const readme = lines(
      "## Results",
      "",
      "```",
      "## Not a heading",
      "# Nor this",
      "```",
      "",
      "Old.",
      "",
      "## Status",
      "",
      "Done.",
      "",
    );

    expect(replaceReadmeSection(readme, "Results", "New.")).toBe(
      lines("## Results", "", "New.", "", "## Status", "", "Done.", ""),
    );
  });

  it("closes a fence only with a bare marker of the same kind and at least the same length", () => {
    const section = (...code: string[]): string =>
      replaceReadmeSection(
        lines("## Results", "", ...code, "", "## Status", ""),
        "Results",
        "New.",
      );
    const replaced = lines("## Results", "", "New.", "", "## Status", "");

    expect(section("````", "```", "## Code", "````")).toBe(replaced);
    expect(section("```", "~~~", "## Code", "```")).toBe(replaced);
    expect(section("~~~~", "~~~", "## Code", "~~~~~")).toBe(replaced);
    expect(section("```", "```js", "## Code", "```  ")).toBe(replaced);
  });

  it("reads tilde fences and fences indented by up to three spaces", () => {
    const readme = lines(
      "~~~",
      "## Results",
      "~~~",
      "   ```",
      "## Results",
      "   ```",
      "",
    );

    expect(replaceReadmeSection(readme, "Results", "New.")).toBe(
      lines(
        "~~~",
        "## Results",
        "~~~",
        "   ```",
        "## Results",
        "   ```",
        "",
        "## Results",
        "",
        "New.",
        "",
      ),
    );
  });

  it("does not open a fence from an indented code line, inline backticks or a backtick info string", () => {
    for (const notAFence of [
      "    ```",
      "Use ``` to start a fence.",
      "```js `x` ```",
      "``",
    ]) {
      expect(
        replaceReadmeSection(
          lines("## Results", "", notAFence, "", "## Status", ""),
          "Results",
          "New.",
        ),
      ).toBe(lines("## Results", "", "New.", "", "## Status", ""));
    }
  });

  it("treats an unclosed fence as code up to the end of the file", () => {
    const readme = lines("## Results", "", "```", "## Status", "Done.", "");

    expect(replaceReadmeSection(readme, "Results", "New.")).toBe(
      lines("## Results", "", "New.", ""),
    );
  });
});

describe("readInput", () => {
  const PATHS = [
    "metrics.json",
    "lighthouse/legacy/manifest.json",
    "audit-legacy.json",
    "mutation/legacy/mutation.json",
    "coverage/legacy/coverage-summary.json",
    "lighthouse/next/manifest.json",
    "audit-next.json",
    "mutation/next/mutation.json",
    "coverage/next/coverage-summary.json",
  ];

  it("reads every report from the layout the results job downloads into", () => {
    const requested: string[] = [];
    const read = (path: string): string => {
      requested.push(path);
      return JSON.stringify({ path });
    };

    expect(readInput(read, RUN)).toEqual({
      runUrl: RUN,
      metrics: { path: "metrics.json" },
      legacy: {
        lighthouse: { path: "lighthouse/legacy/manifest.json" },
        audit: { path: "audit-legacy.json" },
        mutation: { path: "mutation/legacy/mutation.json" },
        coverage: { path: "coverage/legacy/coverage-summary.json" },
      },
      next: {
        lighthouse: { path: "lighthouse/next/manifest.json" },
        audit: { path: "audit-next.json" },
        mutation: { path: "mutation/next/mutation.json" },
        coverage: { path: "coverage/next/coverage-summary.json" },
      },
    });
    expect(requested.toSorted()).toEqual(PATHS.toSorted());
  });

  it("keeps a missing report apart from one that does not parse", () => {
    const read = (path: string): string | undefined =>
      path === "metrics.json"
        ? "{ not json"
        : path === "audit-next.json"
          ? "[1, 2]"
          : undefined;

    expect(readInput(read, RUN)).toEqual({
      runUrl: RUN,
      metrics: null,
      legacy: MISSING,
      next: { ...MISSING, audit: [1, 2] },
    });
  });
});

describe("runUrlFrom", () => {
  const usage = new Error("Usage: pnpm results -- --run <CI run URL>");

  it("reads the run URL", () => {
    expect(runUrlFrom(["--run", RUN])).toBe(RUN);
    expect(runUrlFrom([`--run=${RUN}`])).toBe(RUN);
    expect(runUrlFrom(["--run", "http://localhost:8080/runs/1"])).toBe(
      "http://localhost:8080/runs/1",
    );
  });

  it("skips the separator pnpm passes through", () => {
    expect(runUrlFrom(["--", "--run", RUN])).toBe(RUN);
  });

  it("exports the usage line the command prints", () => {
    expect(USAGE).toBe(usage.message);
  });

  it.each([
    ["nothing", []],
    ["only the separator", ["--"]],
    ["an empty value", ["--run", ""]],
    ["a value that is not a URL", ["--run", "run 123"]],
    ["a URL that is not on the web", ["--run", "file:///runs/123"]],
  ])("rejects %s with the usage line", (_name, argv) => {
    expect(() => runUrlFrom(argv)).toThrow(usage);
  });

  it.each([
    ["a flag without a value", ["--run"]],
    ["an extra argument", ["--run", RUN, "extra"]],
    ["an unknown flag", ["--run", RUN, "--commit"]],
    ["a second separator", ["--", "--", "--run", RUN]],
  ])("rejects %s", (_name, argv) => {
    expect(() => runUrlFrom(argv)).toThrow(TypeError);
  });
});
