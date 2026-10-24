import { execFileSync } from "node:child_process";
import {
  affectedAreas,
  everyArea,
  formatOutputs,
  gitDiffArgs,
  parseChangesArgs,
  type ChangesRequest,
} from "./changes.ts";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

let request: ChangesRequest;
try {
  request = parseChangesArgs(process.argv.slice(2));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const changedPaths = ({ base, head }: { base: string; head: string }) => {
  const args = gitDiffArgs(base, head);
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }).split("\n");
  } catch {
    return fail(
      `Change detection failed: git ${args.join(" ")} did not succeed.`,
    );
  }
};

const areas =
  "all" in request ? everyArea() : affectedAreas(changedPaths(request));

console.log(formatOutputs(areas));
