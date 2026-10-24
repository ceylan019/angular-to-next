import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isRecord } from "../metrics/audit.ts";
import { countMutants, mutationScore } from "../results/results.ts";

export type MutationReport = {
  schemaVersion: string;
  files: Record<string, unknown>;
  testFiles?: Record<string, unknown>;
  [field: string]: unknown;
};
export type Verdict = { passed: boolean; message: string };

const ELEMENTS_BUNDLE = "mutation-testing-elements/mutation-test-elements.js";
const BREAK = /^\d+(?:\.\d+)?$/;

const isReport = (value: unknown): value is MutationReport =>
  isRecord(value) &&
  typeof value.schemaVersion === "string" &&
  isRecord(value.files) &&
  (value.testFiles === undefined || isRecord(value.testFiles));

export function mergeReports(reports: readonly unknown[]): MutationReport {
  const checked = reports.map((report, index) => {
    if (!isReport(report)) {
      throw new Error(
        `Report ${String(index + 1)} is not a mutation testing report.`,
      );
    }
    return report;
  });
  const [first] = checked;
  if (first === undefined) {
    throw new Error("At least one mutation report is required.");
  }
  const files = new Map<string, unknown>();
  const testFiles = new Map<string, unknown>();
  for (const report of checked) {
    for (const [path, file] of Object.entries(report.files)) {
      if (files.has(path)) {
        throw new Error(
          `${path} is in more than one report, but shards must not overlap.`,
        );
      }
      files.set(path, file);
    }
    for (const [path, tests] of Object.entries(report.testFiles ?? {})) {
      if (!testFiles.has(path)) testFiles.set(path, tests);
    }
  }
  const merged: MutationReport = {
    ...first,
    files: Object.fromEntries(files),
  };
  if (checked.some((report) => report.testFiles !== undefined)) {
    merged.testFiles = Object.fromEntries(testFiles);
  }
  return merged;
}

export function reportHtml(
  report: MutationReport,
  elementsScript: string,
): string {
  if (/<\/script/i.test(elementsScript)) {
    throw new Error(
      "The mutation testing elements bundle cannot be inlined: it contains </script.",
    );
  }
  const json = JSON.stringify(report).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<script>
${elementsScript}
</script>
</head>
<body>
<mutation-test-report-app titlePostfix="Stryker"></mutation-test-report-app>
<script>
const app = document.querySelector("mutation-test-report-app");
app.report = ${json};
app.addEventListener("theme-changed", () => {
  document.body.style.backgroundColor = app.themeBackgroundColor;
});
</script>
</body>
</html>
`;
}

export function readElementsScript(): string {
  const require = createRequire(import.meta.url);
  return readFileSync(require.resolve(ELEMENTS_BUNDLE), "utf8");
}

export function parseBreak(text: string): number {
  const value = Number(text);
  if (!BREAK.test(text) || value > 100) {
    throw new Error(
      `Invalid --break ${JSON.stringify(text)}: use a score from 0 to 100.`,
    );
  }
  return value;
}

export function judgeScore(report: MutationReport, threshold: number): Verdict {
  const score = mutationScore(report);
  const { killed, timeout, survived, noCoverage } = countMutants(report);
  const passed = score >= threshold;
  const counts = `${String(killed)} killed, ${String(timeout)} timed out, ${String(survived)} survived, ${String(noCoverage)} not covered`;
  const outcome = passed ? "meets" : "is below";
  return {
    passed,
    message: `Mutation score ${score.toFixed(1)}% (${counts}) ${outcome} the break threshold of ${String(threshold)}.`,
  };
}
