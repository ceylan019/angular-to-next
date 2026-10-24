import { parseArgs } from "node:util";

export const AREAS = [
  "backend",
  "web",
  "legacy",
  "e2e",
  "scripts",
  "lighthouse",
  "docs",
] as const;
export type Area = (typeof AREAS)[number];
export type ChangesRequest = { all: true } | { base: string; head: string };

export const USAGE =
  "Usage: node scripts/ci/cli.ts --all | --base <sha> --head <sha>";

const COMMIT = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

const isRootMarkdown = (path: string): boolean =>
  !path.includes("/") && path.endsWith(".md");

function areaOf(path: string): Area | undefined {
  if (path === "LICENSE" || isRootMarkdown(path)) return "docs";
  return AREAS.find((area) => path.startsWith(`${area}/`));
}

export function affectedAreas(paths: readonly string[]): Record<Area, boolean> {
  const changed = paths.filter((path) => path.trim() !== "");
  const areas = changed.map(areaOf);
  const shared = areas.includes(undefined);
  return Object.fromEntries(
    AREAS.map((area) => [area, shared || areas.includes(area)]),
  ) as Record<Area, boolean>;
}

export function everyArea(): Record<Area, boolean> {
  return Object.fromEntries(AREAS.map((area) => [area, true])) as Record<
    Area,
    boolean
  >;
}

export function formatOutputs(areas: Record<Area, boolean>): string {
  return AREAS.map((area) => `${area}=${String(areas[area])}`).join("\n");
}

export function gitDiffArgs(base: string, head: string): string[] {
  return ["diff", "--name-only", "--no-renames", base, head];
}

const refuse = (reason: string): never => {
  throw new Error(`${reason}\n${USAGE}`);
};

export function parseChangesArgs(argv: readonly string[]): ChangesRequest {
  let values: { all?: boolean; base?: string; head?: string } = {};
  try {
    values = parseArgs({
      args: [...argv],
      options: {
        all: { type: "boolean" },
        base: { type: "string" },
        head: { type: "string" },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    refuse(error instanceof Error ? error.message : String(error));
  }
  const { all, base, head } = values;
  if (all === true) {
    return base === undefined && head === undefined
      ? { all }
      : refuse("Pass either --all or --base and --head, not both.");
  }
  if (base === undefined && head === undefined) {
    return refuse("Pass --all, or --base and --head.");
  }
  if (base === undefined || head === undefined) {
    return refuse("Pass --base and --head together.");
  }
  if (!COMMIT.test(base) || !COMMIT.test(head)) {
    return refuse("--base and --head must be full commit SHAs.");
  }
  return { base, head };
}
