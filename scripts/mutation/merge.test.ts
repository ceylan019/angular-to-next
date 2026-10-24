import { describe, expect, it } from "vitest";
import { ReportError } from "../metrics/audit.ts";
import {
  judgeScore,
  mergeReports,
  parseBreak,
  readElementsScript,
  reportHtml,
  type MutationReport,
} from "./merge.ts";

const refusal = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof Error
      ? error.message
      : `not an Error: ${String(error)}`;
  }
  return "no refusal";
};

const mutant = (id: string, status: string) => ({
  id,
  mutatorName: "BooleanLiteral",
  replacement: "false",
  location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
  status,
});

const source = (path: string, ...statuses: string[]) => ({
  language: "typescript",
  source: `export const value = "${path}";\n`,
  mutants: statuses.map((status, index) => mutant(String(index), status)),
});

const report = (
  files: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): MutationReport => ({
  schemaVersion: "1.0",
  thresholds: { high: 95, low: 90, break: 90 },
  projectRoot: "/runner/work/web",
  config: { testRunner: "command" },
  framework: { name: "StrykerJS", version: "10.0.0" },
  files,
  ...extra,
});

const ELEMENTS = "customElements.define('mutation-test-report-app', class {});";

const embeddedReport = (html: string): unknown => {
  const start = html.indexOf("app.report = ") + "app.report = ".length;
  const end = html.indexOf(";\n", start);
  return JSON.parse(html.slice(start, end)) as unknown;
};

const count = (text: string, part: string): number =>
  text.split(part).length - 1;

describe("mergeReports", () => {
  it("joins the files of every report", () => {
    const merged = mergeReports([
      report({ "src/a.ts": source("a", "Killed") }),
      report({ "src/b.ts": source("b", "Survived") }),
      report({ "src/c.ts": source("c", "Timeout") }),
    ]);
    expect(merged.files).toEqual({
      "src/a.ts": source("a", "Killed"),
      "src/b.ts": source("b", "Survived"),
      "src/c.ts": source("c", "Timeout"),
    });
    expect(Object.keys(merged.files)).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
    ]);
  });

  it("keeps the top level fields of the first report", () => {
    const merged = mergeReports([
      report({ "src/a.ts": source("a") }),
      report(
        { "src/b.ts": source("b") },
        {
          schemaVersion: "2.0",
          thresholds: { high: 1, low: 0, break: null },
          projectRoot: "/elsewhere",
          config: { testRunner: "vitest" },
          framework: { name: "Other" },
          extra: "second only",
        },
      ),
    ]);
    expect(merged).toEqual({
      schemaVersion: "1.0",
      thresholds: { high: 95, low: 90, break: 90 },
      projectRoot: "/runner/work/web",
      config: { testRunner: "command" },
      framework: { name: "StrykerJS", version: "10.0.0" },
      files: { "src/a.ts": source("a"), "src/b.ts": source("b") },
    });
  });

  it("keeps a single report as it is", () => {
    const only = report({ "src/a.ts": source("a", "Killed") });
    expect(mergeReports([only])).toEqual(only);
  });

  it("accepts a report without files", () => {
    expect(
      mergeReports([report({}), report({ "src/a.ts": source("a") })]).files,
    ).toEqual({ "src/a.ts": source("a") });
  });

  it("leaves the input reports unchanged", () => {
    const first = report({ "src/a.ts": source("a") });
    const second = report({ "src/b.ts": source("b") });
    mergeReports([first, second]);
    expect(first.files).toEqual({ "src/a.ts": source("a") });
    expect(second.files).toEqual({ "src/b.ts": source("b") });
  });

  it("refuses a file that is in more than one report, because shards must not overlap", () => {
    expect(
      refusal(() =>
        mergeReports([
          report({ "src/a.ts": source("a") }),
          report({ "src/b.ts": source("b") }),
          report({ "src/b.ts": source("b") }),
        ]),
      ),
    ).toBe("src/b.ts is in more than one report, but shards must not overlap.");
  });

  it("refuses an empty list of reports", () => {
    expect(refusal(() => mergeReports([]))).toBe(
      "At least one mutation report is required.",
    );
  });

  it.each([
    ["null", null],
    ["a list", [report({})]],
    ["text", "report"],
    ["a number", 1],
    ["an object without a schema version", { files: {} }],
    ["an object without files", { schemaVersion: "1.0" }],
    ["a schema version that is not text", { schemaVersion: 1, files: {} }],
    ["files that are a list", { schemaVersion: "1.0", files: [] }],
    ["files that are null", { schemaVersion: "1.0", files: null }],
    [
      "test files that are a list",
      { schemaVersion: "1.0", files: {}, testFiles: [] },
    ],
    [
      "test files that are null",
      { schemaVersion: "1.0", files: {}, testFiles: null },
    ],
  ])("refuses %s, naming its position", (_label, value) => {
    expect(
      refusal(() => mergeReports([report({ "src/a.ts": source("a") }), value])),
    ).toBe("Report 2 is not a mutation testing report.");
    expect(refusal(() => mergeReports([value]))).toBe(
      "Report 1 is not a mutation testing report.",
    );
  });

  it("joins test files, keeping the first entry for a name in two reports", () => {
    const merged = mergeReports([
      report(
        { "src/a.ts": source("a") },
        { testFiles: { "": { tests: [1] } } },
      ),
      report(
        { "src/b.ts": source("b") },
        { testFiles: { "": { tests: [2] }, "b.test.ts": { tests: [3] } } },
      ),
    ]);
    expect(merged.testFiles).toEqual({
      "": { tests: [1] },
      "b.test.ts": { tests: [3] },
    });
  });

  it("takes test files from a later report when the first has none", () => {
    const merged = mergeReports([
      report({ "src/a.ts": source("a") }),
      report(
        { "src/b.ts": source("b") },
        { testFiles: { "": { tests: [2] } } },
      ),
    ]);
    expect(merged.testFiles).toEqual({ "": { tests: [2] } });
  });

  it("leaves test files out when no report has them", () => {
    const merged = mergeReports([
      report({ "src/a.ts": source("a") }),
      report({ "src/b.ts": source("b") }),
    ]);
    expect("testFiles" in merged).toBe(false);
  });

  it("keeps a file named __proto__ as a plain entry", () => {
    const odd = JSON.parse(
      '{"schemaVersion":"1.0","files":{"__proto__":{"mutants":[]}}}',
    ) as unknown;
    const merged = mergeReports([odd, report({ "src/a.ts": source("a") })]);
    expect(Object.keys(merged.files)).toEqual(["__proto__", "src/a.ts"]);
    expect(Object.getPrototypeOf(merged.files)).toBe(Object.prototype);
    expect(
      refusal(() =>
        mergeReports([
          odd,
          JSON.parse(
            '{"schemaVersion":"1.0","files":{"__proto__":{"mutants":[]}}}',
          ),
        ]),
      ),
    ).toBe(
      "__proto__ is in more than one report, but shards must not overlap.",
    );
  });
});

describe("reportHtml", () => {
  const sample = report(
    { "src/a.ts": source("a", "Killed", "Survived") },
    { testFiles: { "": { tests: [{ id: "0", name: "All tests" }] } } },
  );

  it("is a standalone page with the elements bundle inlined", () => {
    const html = reportHtml(sample, ELEMENTS);
    expect(html.startsWith("<!doctype html>\n")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain(`<script>\n${ELEMENTS}\n</script>`);
    expect(html).not.toContain("<link");
    expect(html).not.toContain(" src=");
    expect(html.endsWith("</html>\n")).toBe(true);
  });

  it("renders the report app after the bundle and hands it the report", () => {
    const html = reportHtml(sample, ELEMENTS);
    const app = html.indexOf(
      '<mutation-test-report-app titlePostfix="Stryker">',
    );
    expect(app).toBeGreaterThan(html.indexOf(ELEMENTS));
    expect(html.indexOf("app.report = ")).toBeGreaterThan(app);
    expect(html).toContain(
      'const app = document.querySelector("mutation-test-report-app");',
    );
    expect(embeddedReport(html)).toEqual(sample);
  });

  it("follows the theme the report app picks", () => {
    const html = reportHtml(sample, ELEMENTS);
    expect(html).toContain(
      'app.addEventListener("theme-changed", () => {\n  document.body.style.backgroundColor = app.themeBackgroundColor;\n});',
    );
  });

  it("escapes < in the report so source code cannot close the script", () => {
    const hostile = report({
      "src/<b>.ts": {
        language: "typescript",
        source: 'const a = "</script><script>alert(1)</script><!--";\n',
        mutants: [mutant("0", "Killed")],
      },
    });
    const html = reportHtml(hostile, ELEMENTS);
    expect(count(html, "</script>")).toBe(2);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<!--");
    expect(html).not.toContain("<b>");
    expect(html).toContain("\\u003c/script>\\u003cscript>alert(1)");
    expect(embeddedReport(html)).toEqual(hostile);
  });

  it("refuses a bundle that would end its own script early", () => {
    expect(refusal(() => reportHtml(sample, "a('</script>')"))).toBe(
      "The mutation testing elements bundle cannot be inlined: it contains </script.",
    );
    expect(refusal(() => reportHtml(sample, "a('</SCRIPT >')"))).toBe(
      "The mutation testing elements bundle cannot be inlined: it contains </script.",
    );
  });
});

describe("readElementsScript", () => {
  it("reads the mutation testing elements bundle that defines the report app", () => {
    const script = readElementsScript();
    expect(script).toContain("mutation-test-report-app");
    expect(script).toContain("customElements");
    expect(script.length).toBeGreaterThan(100_000);
    expect(script.toLowerCase()).not.toContain("</script");
  });
});

describe("parseBreak", () => {
  it.each([
    ["90", 90],
    ["0", 0],
    ["100", 100],
    ["92.5", 92.5],
    ["92.25", 92.25],
    ["100.0", 100],
  ])("reads %s as %d", (text, value) => {
    expect(parseBreak(text)).toBe(value);
  });

  it.each([
    "",
    "abc",
    "-1",
    "100.1",
    "101",
    "1e2",
    " 90",
    "90 ",
    "NaN",
    "Infinity",
    "0x5a",
    ".5",
    "5.",
    "+90",
    "90%",
  ])("refuses %j", (text) => {
    expect(refusal(() => parseBreak(text))).toBe(
      `Invalid --break ${JSON.stringify(text)}: use a score from 0 to 100.`,
    );
  });
});

describe("judgeScore", () => {
  const scored = (...statuses: string[]): MutationReport =>
    report({ "src/a.ts": source("a", ...statuses) });

  it("passes a score equal to the break threshold", () => {
    const nine = Array.from({ length: 9 }, () => "Killed");
    expect(judgeScore(scored(...nine, "Survived"), 90)).toEqual({
      passed: true,
      message:
        "Mutation score 90.0% (9 killed, 0 timed out, 1 survived, 0 not covered) meets the break threshold of 90.",
    });
  });

  it("fails a score below the break threshold", () => {
    const nine = Array.from({ length: 9 }, () => "Killed");
    expect(judgeScore(scored(...nine, "Survived"), 90.1)).toEqual({
      passed: false,
      message:
        "Mutation score 90.0% (9 killed, 0 timed out, 1 survived, 0 not covered) is below the break threshold of 90.1.",
    });
  });

  it("counts timeouts as detected and lists them apart from kills", () => {
    expect(
      judgeScore(scored("Killed", "Timeout", "Survived", "NoCoverage"), 50),
    ).toEqual({
      passed: true,
      message:
        "Mutation score 50.0% (1 killed, 1 timed out, 1 survived, 1 not covered) meets the break threshold of 50.",
    });
  });

  it("passes a score of zero against a threshold of zero", () => {
    expect(judgeScore(scored("Survived"), 0).passed).toBe(true);
  });

  it("scores the files of every merged shard together", () => {
    const merged = mergeReports([
      report({ "src/a.ts": source("a", "Killed", "Killed") }),
      report({ "src/b.ts": source("b", "Survived", "Killed") }),
    ]);
    expect(judgeScore(merged, 80)).toEqual({
      passed: false,
      message:
        "Mutation score 75.0% (3 killed, 0 timed out, 1 survived, 0 not covered) is below the break threshold of 80.",
    });
  });

  it("refuses a report without valid mutants", () => {
    expect(() => judgeScore(scored("Ignored"), 90)).toThrow(
      new ReportError("no valid mutants"),
    );
    expect(() => judgeScore(scored("Ignored"), 90)).toThrow(ReportError);
  });
});
