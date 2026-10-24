import { globSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { isRecord } from "../metrics/audit.ts";

export type SizedFile = { path: string; size: number };
export type Shard = { index: number; total: number };

const SPEC = /^([1-9]\d*)\/([1-9]\d*)$/;
const RANGE = /:\d+-\d+(?::\d+)?$/;
const PATTERN_CHARACTERS = /[,*?[\]{}()!#:\\]/;

function checkShard(index: number, total: number, spec: string): Shard {
  if (
    !Number.isSafeInteger(index) ||
    !Number.isSafeInteger(total) ||
    index < 1 ||
    index > total
  ) {
    throw new Error(
      `Invalid shard ${spec}: use <index>/<total> with whole numbers and 1 <= index <= total.`,
    );
  }
  return { index, total };
}

export function parseShard(spec: string): Shard {
  const match = SPEC.exec(spec);
  return checkShard(
    Number(match?.[1]),
    Number(match?.[2]),
    JSON.stringify(spec),
  );
}

export function shardFiles(
  files: readonly SizedFile[],
  index: number,
  total: number,
): string[] {
  checkShard(index, total, `${String(index)}/${String(total)}`);
  const sizes = new Map<string, number>();
  for (const { path, size } of files) {
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Invalid size ${String(size)} for ${path}.`);
    }
    if (sizes.has(path)) throw new Error(`${path} is listed more than once.`);
    sizes.set(path, size);
  }
  const sizeOf = (path: string): number => sizes.get(path) ?? 0;
  const largestFirst = [...sizes.keys()]
    .sort()
    .sort((a, b) => sizeOf(b) - sizeOf(a));
  const shards = Array.from({ length: total }, (_, at) => ({ at, size: 0 }));
  const chosen: string[] = [];
  for (const path of largestFirst) {
    const lightest = shards.reduce((best, shard) =>
      shard.size < best.size ? shard : best,
    );
    lightest.size += sizeOf(path);
    if (lightest.at === index - 1) chosen.push(path);
  }
  return chosen.sort();
}

export function mutateFiles(
  patterns: readonly string[],
  cwd: string,
): string[] {
  const selected = new Set<string>();
  for (const pattern of patterns) {
    const excluded = pattern.startsWith("!");
    const matches = globSync(excluded ? pattern.slice(1) : pattern, { cwd })
      .map((path) => path.split(sep).join("/"))
      .filter((path) => statSync(join(cwd, path)).isFile());
    for (const path of matches) {
      if (excluded) selected.delete(path);
      else selected.add(path);
    }
  }
  return [...selected].sort();
}

const mutatePatterns = (config: unknown): string[] => {
  const mutate = isRecord(config) ? config.mutate : undefined;
  if (
    !Array.isArray(mutate) ||
    mutate.length === 0 ||
    !mutate.every((pattern) => typeof pattern === "string")
  ) {
    throw new Error("The Stryker config has no mutate list of glob patterns.");
  }
  return mutate;
};

export function planShard(
  config: unknown,
  configDir: string,
  spec: string,
): string[] {
  const patterns = mutatePatterns(config);
  const ranged = patterns.find((pattern) => RANGE.test(pattern));
  if (ranged !== undefined) {
    throw new Error(`Mutation ranges cannot be sharded: ${ranged}`);
  }
  const { index, total } = parseShard(spec);
  const paths = mutateFiles(patterns, configDir);
  if (paths.length === 0) {
    throw new Error("The mutate patterns match no files.");
  }
  const odd = paths.find((path) => PATTERN_CHARACTERS.test(path));
  if (odd !== undefined) {
    throw new Error(`Cannot pass ${odd} to Stryker --mutate as a plain path.`);
  }
  const files = paths.map((path) => ({
    path,
    size: statSync(join(configDir, path)).size,
  }));
  return shardFiles(files, index, total);
}
