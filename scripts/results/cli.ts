import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildReadmeSection,
  buildResults,
  readInput,
  replaceReadmeSection,
  runUrlFrom,
  USAGE,
} from "./results.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const REPORTS = join(ROOT, "reports");
const README = join(ROOT, "README.md");
const OUTPUT = "docs/results.md";

const readReport = (path: string): string | undefined => {
  try {
    return readFileSync(join(REPORTS, path), "utf8");
  } catch {
    return undefined;
  }
};

let runUrl: string;
try {
  runUrl = runUrlFrom(process.argv.slice(2));
} catch {
  console.error(USAGE);
  process.exit(2);
}

const input = readInput(readReport, runUrl);
writeFileSync(join(ROOT, OUTPUT), buildResults(input));
writeFileSync(
  README,
  replaceReadmeSection(
    readFileSync(README, "utf8"),
    "Results",
    buildReadmeSection(input),
  ),
);
console.log(`Wrote ${OUTPUT} and the README results section for ${runUrl}.`);
