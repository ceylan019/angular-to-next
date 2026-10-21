import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import {
  buildTraceability,
  checkFlowTags,
  extractTestIds,
  FLOWS_MODULE,
  parseEnabledFlows,
  parseKnownDifferences,
  parseRequirements,
  type Layer,
  type SourceFile,
} from "./traceability.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const OUTPUT = "docs/traceability.md";

const SUITES: readonly { layer: Layer; patterns: string[] }[] = [
  { layer: "legacy", patterns: ["legacy/src/**/*.spec.ts"] },
  {
    layer: "web",
    patterns: ["web/src/**/*.test.ts", "web/src/**/*.test.tsx"],
  },
  {
    layer: "api",
    patterns: ["backend/src/**/*.test.ts", "backend/test/**/*.test.ts"],
  },
  { layer: "e2e", patterns: ["e2e/tests/**/*.spec.ts"] },
];

const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

const files: SourceFile[] = SUITES.flatMap(({ layer, patterns }) =>
  globSync(patterns, { cwd: ROOT })
    .map((path) => path.split(sep).join("/"))
    .sort()
    .map((path) => ({ path, layer, content: read(path) })),
);

const requirements = parseRequirements(read("docs/requirements.md"));
const knownDifferences = parseKnownDifferences(
  read("docs/known-differences.md"),
);
const { markdown, problems } = buildTraceability({
  requirements,
  knownDifferences,
  hits: files.flatMap(extractTestIds),
  enabledFlows: parseEnabledFlows(read(FLOWS_MODULE)),
});
const allProblems = [
  ...problems,
  ...checkFlowTags(files.filter((file) => file.layer === "e2e")),
];

writeFileSync(join(ROOT, OUTPUT), markdown);

if (allProblems.length > 0) {
  console.error(`Traceability problems:\n${allProblems.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Traced ${String(requirements.length)} requirements and ${String(knownDifferences.length)} known differences across ${String(files.length)} test files into ${OUTPUT}.`,
  );
}
