import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SKIPPED_FOLDERS = new Set(["zz-debug", "zz-probe"]);
const SOURCE_FILE = /\.(ts|tsx)$/;
const DIRECTIVE = /^\s*(["'])use client\1/;

function walk(root: string, folder: string): string[] {
  return readdirSync(path.join(root, folder), { withFileTypes: true }).flatMap(
    (entry) => {
      const relative = path.posix.join(folder, entry.name);
      if (entry.isDirectory()) {
        return SKIPPED_FOLDERS.has(entry.name) ? [] : walk(root, relative);
      }
      return SOURCE_FILE.test(entry.name) ? [relative] : [];
    },
  );
}

export function findClientModules(root: string): string[] {
  return walk(root, ".")
    .map((file) => file.replace(/^\.\//, ""))
    .filter((file) =>
      DIRECTIVE.test(readFileSync(path.join(root, file), "utf8")),
    )
    .sort();
}

export function unclassifiedClientModules(
  found: readonly string[],
  classified: readonly string[],
): string[] {
  return found.filter((file) => !classified.includes(file));
}
