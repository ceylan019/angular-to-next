import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import {
  judgeScore,
  mergeReports,
  parseBreak,
  readElementsScript,
  reportHtml,
} from "./merge.ts";
import { planShard } from "./shard.ts";

const USAGE = [
  "Usage: node scripts/mutation/cli.ts shard --config <stryker.config.json> --shard <index>/<total>",
  "       node scripts/mutation/cli.ts merge --out <folder> --break <score> <report.json>...",
].join("\n");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8")) as unknown;

function shard(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: { config: { type: "string" }, shard: { type: "string" } },
    strict: true,
    allowPositionals: false,
  });
  if (values.config === undefined || values.shard === undefined) fail(USAGE);
  const config = readJson(values.config);
  const files = planShard(config, dirname(values.config), values.shard);
  if (files.length > 0) console.log(files.join(","));
}

function merge(args: string[]): void {
  const { values, positionals } = parseArgs({
    args,
    options: { out: { type: "string" }, break: { type: "string" } },
    strict: true,
    allowPositionals: true,
  });
  if (values.out === undefined || values.break === undefined) fail(USAGE);
  const threshold = parseBreak(values.break);
  const report = mergeReports(
    positionals.map((path) => {
      try {
        return readJson(path);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot read ${path}: ${reason}`, { cause: error });
      }
    }),
  );
  mkdirSync(values.out, { recursive: true });
  writeFileSync(join(values.out, "mutation.json"), JSON.stringify(report));
  writeFileSync(
    join(values.out, "index.html"),
    reportHtml(report, readElementsScript()),
  );
  const { passed, message } = judgeScore(report, threshold);
  console.log(`Merged ${positionals.join(", ")} into ${values.out}.`);
  console.log(message);
  if (!passed) process.exitCode = 1;
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "shard") shard(args);
  else if (command === "merge") merge(args);
  else fail(USAGE);
} catch (error) {
  fail(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
}
