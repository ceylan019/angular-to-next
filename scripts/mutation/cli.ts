import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { planShard } from "./shard.ts";

const USAGE =
  "Usage: node scripts/mutation/cli.ts shard --config <stryker.config.json> --shard <index>/<total>";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function shard(args: string[]): void {
  const { values } = parseArgs({
    args,
    options: { config: { type: "string" }, shard: { type: "string" } },
    strict: true,
    allowPositionals: false,
  });
  if (values.config === undefined || values.shard === undefined) fail(USAGE);
  const config = JSON.parse(readFileSync(values.config, "utf8")) as unknown;
  const files = planShard(config, dirname(values.config), values.shard);
  if (files.length > 0) console.log(files.join(","));
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "shard") shard(args);
  else fail(USAGE);
} catch (error) {
  fail(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
}
