import { parseArgs } from "node:util";
import {
  countVulnerabilities,
  isCount,
  isRecord,
  ReportError,
  unreadable,
  type Vulnerabilities,
} from "../metrics/audit.ts";

export type Category =
  "performance" | "accessibility" | "best-practices" | "seo";
export type Side = "legacy" | "next";
export type SideReports = {
  lighthouse: unknown;
  audit: unknown;
  mutation: unknown;
  coverage: unknown;
};
export type ResultsInput = {
  runUrl: string;
  metrics: unknown;
  legacy: SideReports;
  next: SideReports;
};
export type MutantCounts = {
  killed: number;
  timeout: number;
  survived: number;
  noCoverage: number;
};

type Row = readonly [label: string, legacy: string, next: string];
type Metric = "jsBytes" | "backendCalls";

const PAGES = ["/", "/products/lavender-dusk", "/cart"] as const;
const CATEGORIES: readonly (readonly [Category, string])[] = [
  ["performance", "performance"],
  ["accessibility", "accessibility"],
  ["best-practices", "best practices"],
  ["seo", "SEO"],
];
const COUNTED = new Map<unknown, keyof MutantCounts>([
  ["Killed", "killed"],
  ["Timeout", "timeout"],
  ["Survived", "survived"],
  ["NoCoverage", "noCoverage"],
]);
const NOT_VALID = new Set<unknown>([
  "CompileError",
  "RuntimeError",
  "Ignored",
  "Pending",
]);
const FILES: Record<Side, Record<keyof SideReports, string>> = {
  legacy: {
    lighthouse: "lighthouse/legacy/manifest.json",
    audit: "audit-legacy.json",
    mutation: "mutation/legacy/mutation.json",
    coverage: "coverage/legacy/coverage-summary.json",
  },
  next: {
    lighthouse: "lighthouse/next/manifest.json",
    audit: "audit-next.json",
    mutation: "mutation/next/mutation.json",
    coverage: "coverage/next/coverage-summary.json",
  },
};
const METRICS_FILE = "metrics.json";
const WEB_PROTOCOLS = new Set(["http:", "https:"]);
export const USAGE = "Usage: pnpm results -- --run <CI run URL>";
const SECTION_END = /^#{1,2} /;
const HEADER: Row = ["Metric", "Legacy", "New"];

const INTRO =
  "Old versus new, measured in CI on one runner against the same backend and the same data. Legacy is the Angular 10 app and New is the Next.js app, both running in their production containers.";
const NA_NOTE =
  "A cell reads n/a when its report is missing or unreadable in this run, with the reason in parentheses.";
const LEGACY_MUTATION_NOTE =
  "The legacy mutation score is unavailable for this run because the `mutation-legacy` artifact is missing.";
const METHOD = [
  "## How each number is measured",
  "",
  "- Lighthouse: the median score of 5 mobile runs per page, out of 100.",
  "- JavaScript on first load: the sum of the gzip sizes of each script response body on `/`, compressed by the measuring script with zlib for both apps, because the legacy server does not compress its responses and wire sizes would not compare. Scripts inlined in the HTML are part of the document and not counted. 1 KB is 1024 bytes.",
  "- Backend calls: the API requests the backend counts while a fresh browser loads `/products/lavender-dusk` until the network is idle, server rendering included. The backend's own health and test endpoints are not counted, and the front end health checks load `/cart`, which calls no API.",
  "- Known vulnerabilities: `npm audit --production` with npm 6 for legacy and `pnpm audit --prod` for the new app, counting critical, high, moderate and low advisories.",
  "- Mutation score: detected mutants (killed or timed out) over valid mutants (killed, timed out, survived or not covered), to one decimal. Timeouts are listed next to the score because a loaded machine can turn a timeout into a false kill. The shared backend is mutation tested too and is not a column here.",
  "- Legacy mutation testing runs Stryker 5.6.1 on Node 12, with its dependencies resolved as published before 2025-08-01 (which holds `inquirer` at 8.2.6) and `procps` in the mutation image. Refreshing the legacy lockfile with plain npm 6 breaks it.",
  "- Line coverage: `total.lines.pct` from each app's coverage summary, from Karma with Istanbul for legacy and Vitest with V8 for the new app.",
].join("\n");
const DETAILS =
  "How each number is measured: [docs/results.md](docs/results.md).";

const footer = (runUrl: string): string =>
  `Numbers come from CI run [${runUrl}](${runUrl}), not from a developer machine.`;

const listOf = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : unreadable();

const isFraction = (value: unknown): value is number =>
  typeof value === "number" && value >= 0 && value <= 1;

const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = sorted.slice(
    Math.floor((sorted.length - 1) / 2),
    Math.floor(sorted.length / 2) + 1,
  );
  return middle.reduce((sum, value) => sum + value, 0) / middle.length;
};

export function countMutants(report: unknown): MutantCounts {
  const files = isRecord(report) ? report.files : undefined;
  if (!isRecord(files)) unreadable();
  const counts: MutantCounts = {
    killed: 0,
    timeout: 0,
    survived: 0,
    noCoverage: 0,
  };
  for (const file of Object.values(files)) {
    for (const mutant of listOf(isRecord(file) ? file.mutants : undefined)) {
      const status = isRecord(mutant) ? mutant.status : undefined;
      const counted = COUNTED.get(status);
      if (counted !== undefined) counts[counted] += 1;
      else if (!NOT_VALID.has(status)) unreadable();
    }
  }
  return counts;
}

export function mutationScore(report: unknown): number {
  const { killed, timeout, survived, noCoverage } = countMutants(report);
  const detected = killed + timeout;
  const valid = detected + survived + noCoverage;
  if (valid === 0) throw new ReportError("no valid mutants");
  return Math.round((detected / valid) * 1000) / 10;
}

export function lighthouseScore(
  manifest: unknown,
  page: string,
  category: Category,
): number {
  const scores = listOf(manifest).flatMap((run) => {
    if (
      !isRecord(run) ||
      typeof run.url !== "string" ||
      !URL.canParse(run.url)
    ) {
      unreadable();
    }
    if (new URL(run.url).pathname !== page) return [];
    if (!isRecord(run.summary)) unreadable();
    const score = run.summary[category];
    if (score === null || score === undefined) return [];
    return isFraction(score) ? [score] : unreadable();
  });
  if (scores.length === 0) throw new ReportError("no scored runs");
  return Math.round(median(scores) * 100);
}

export function lineCoverage(summary: unknown): number {
  const total = isRecord(summary) ? summary.total : undefined;
  const lines = isRecord(total) ? total.lines : undefined;
  const pct = isRecord(lines) ? lines.pct : undefined;
  return typeof pct === "number" && pct >= 0 && pct <= 100 ? pct : unreadable();
}

const metric = (metrics: unknown, side: Side, name: Metric): number => {
  const app = isRecord(metrics) ? metrics[side] : undefined;
  const value = isRecord(app) ? app[name] : undefined;
  return isCount(value) ? value : unreadable();
};

const vulnerabilityText = ({
  critical,
  high,
  moderate,
  low,
  total,
}: Vulnerabilities): string =>
  total === 0
    ? "0"
    : `${String(total)} (${String(critical)} critical, ${String(high)} high, ${String(moderate)} moderate, ${String(low)} low)`;

const mutationText = (report: unknown): string => {
  const score = mutationScore(report);
  const { killed, timeout, survived, noCoverage } = countMutants(report);
  return `${score.toFixed(1)}% (${String(killed)} killed, ${String(timeout)} timed out, ${String(survived)} survived, ${String(noCoverage)} not covered)`;
};

const cell = (report: unknown, show: (report: unknown) => string): string => {
  if (report === undefined) return "n/a (report missing)";
  try {
    return show(report);
  } catch (error) {
    if (error instanceof ReportError) return `n/a (${error.message})`;
    throw error;
  }
};

const rows = (input: ResultsInput): Row[] => {
  const row = (label: string, render: (side: Side) => string): Row => [
    label,
    render("legacy"),
    render("next"),
  ];
  return [
    ...CATEGORIES.flatMap(([category, name]) =>
      PAGES.map((page) =>
        row(`Lighthouse ${name}, \`${page}\``, (side) =>
          cell(input[side].lighthouse, (manifest) =>
            String(lighthouseScore(manifest, page, category)),
          ),
        ),
      ),
    ),
    row("JavaScript on first load, `/` (KB, gzip)", (side) =>
      cell(input.metrics, (metrics) =>
        (metric(metrics, side, "jsBytes") / 1024).toFixed(1),
      ),
    ),
    row("Backend calls per product page view", (side) =>
      cell(input.metrics, (metrics) =>
        String(metric(metrics, side, "backendCalls")),
      ),
    ),
    row("Known vulnerabilities (production dependencies)", (side) =>
      cell(input[side].audit, (audit) =>
        vulnerabilityText(countVulnerabilities(audit)),
      ),
    ),
    row("Mutation score", (side) => cell(input[side].mutation, mutationText)),
    row("Line coverage", (side) =>
      cell(
        input[side].coverage,
        (summary) => `${String(lineCoverage(summary))}%`,
      ),
    ),
  ];
};

const table = (body: readonly Row[]): string => {
  const all = [HEADER, ...body];
  const width = (pick: (row: Row) => string): number =>
    Math.max(...all.map((row) => pick(row).length));
  const widths = [
    width(([label]) => label),
    width(([, legacy]) => legacy),
    width(([, , next]) => next),
  ] as const;
  const line = ([label, legacy, next]: Row): string =>
    `| ${label.padEnd(widths[0])} | ${legacy.padEnd(widths[1])} | ${next.padEnd(widths[2])} |`;
  const rule: Row = [
    "-".repeat(widths[0]),
    "-".repeat(widths[1]),
    "-".repeat(widths[2]),
  ];
  return [HEADER, rule, ...body].map(line).join("\n");
};

export function buildResults(input: ResultsInput): string {
  const notes =
    input.legacy.mutation === undefined
      ? [NA_NOTE, LEGACY_MUTATION_NOTE]
      : [NA_NOTE];
  return `${[
    "# Results",
    INTRO,
    table(rows(input)),
    ...notes,
    METHOD,
    footer(input.runUrl),
  ].join("\n\n")}\n`;
}

export function buildReadmeSection(input: ResultsInput): string {
  return `${table(rows(input))}\n\n${DETAILS} ${footer(input.runUrl)}`;
}

export function replaceReadmeSection(
  readme: string,
  heading: string,
  body: string,
): string {
  const title = `## ${heading}`;
  const lines = readme.split("\n");
  const start = lines.findIndex((line) => line.trimEnd() === title);
  const end =
    start === -1
      ? -1
      : lines.findIndex(
          (line, index) => index > start && SECTION_END.test(line),
        );
  const before = start === -1 ? readme : lines.slice(0, start).join("\n");
  const after = end === -1 ? "" : lines.slice(end).join("\n");
  return `${[before.trimEnd(), `${title}\n\n${body.trim()}`, after.trimEnd()]
    .filter((part) => part !== "")
    .join("\n\n")}\n`;
}

const parseReport = (text: string | undefined): unknown => {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

export function readInput(
  read: (path: string) => string | undefined,
  runUrl: string,
): ResultsInput {
  const side = (files: Record<keyof SideReports, string>): SideReports => ({
    lighthouse: parseReport(read(files.lighthouse)),
    audit: parseReport(read(files.audit)),
    mutation: parseReport(read(files.mutation)),
    coverage: parseReport(read(files.coverage)),
  });
  return {
    runUrl,
    metrics: parseReport(read(METRICS_FILE)),
    legacy: side(FILES.legacy),
    next: side(FILES.next),
  };
}

export function runUrlFrom(argv: readonly string[]): string {
  const { run } = parseArgs({
    args: argv[0] === "--" ? argv.slice(1) : [...argv],
    options: { run: { type: "string" } },
  }).values;
  const url = URL.parse(String(run));
  if (url === null || !WEB_PROTOCOLS.has(url.protocol)) {
    throw new Error(USAGE);
  }
  return url.href;
}
