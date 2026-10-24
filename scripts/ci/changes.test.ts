import { describe, expect, it } from "vitest";
import {
  affectedAreas,
  AREAS,
  everyArea,
  formatOutputs,
  gitDiffArgs,
  parseChangesArgs,
  USAGE,
  type Area,
} from "./changes.ts";

const BASE = "0123456789abcdef0123456789abcdef01234567";
const HEAD = "89abcdef0123456789abcdef0123456789abcdef";

const only = (...areas: Area[]): Record<Area, boolean> => ({
  backend: areas.includes("backend"),
  web: areas.includes("web"),
  legacy: areas.includes("legacy"),
  e2e: areas.includes("e2e"),
  scripts: areas.includes("scripts"),
  lighthouse: areas.includes("lighthouse"),
  docs: areas.includes("docs"),
});

const EVERY_AREA = only(...AREAS);
const NO_AREA = only();

describe("AREAS", () => {
  it("lists the areas in output order", () => {
    expect(AREAS).toEqual([
      "backend",
      "web",
      "legacy",
      "e2e",
      "scripts",
      "lighthouse",
      "docs",
    ]);
  });
});

describe("affectedAreas", () => {
  it.each([
    ["backend/src/app.ts", "backend"],
    ["web/src/lib/money.ts", "web"],
    ["legacy/src/app/app.module.ts", "legacy"],
    ["e2e/tests/cart/cart.spec.ts", "e2e"],
    ["scripts/results/results.ts", "scripts"],
    ["lighthouse/lighthouserc.next.json", "lighthouse"],
  ] as const)("maps %s to the %s area only", (path, area) => {
    expect(affectedAreas([path])).toEqual(only(area));
  });

  it("maps a file at the top of an area folder to that area", () => {
    expect(affectedAreas(["web/package.json"])).toEqual(only("web"));
    expect(affectedAreas(["legacy/Dockerfile"])).toEqual(only("legacy"));
  });

  it("counts Markdown inside an area folder as that area", () => {
    expect(affectedAreas(["web/README.md"])).toEqual(only("web"));
    expect(affectedAreas(["backend/docs/notes.md"])).toEqual(only("backend"));
  });

  it.each([
    "docs/requirements.md",
    "docs/media/side-by-side.gif",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
  ])("maps %s to the docs area only", (path) => {
    expect(affectedAreas([path])).toEqual(only("docs"));
  });

  it.each([
    ".github/workflows/ci.yml",
    ".github/workflows/flake-check.yml",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "docker-compose.yml",
    ".nvmrc",
    ".prettierrc.json",
    ".prettierignore",
    ".gitignore",
    ".dockerignore",
    "Makefile",
    "tools/check.sh",
  ])("treats %s as shared, which touches every area", (path) => {
    expect(affectedAreas([path])).toEqual(EVERY_AREA);
  });

  it.each([
    ["web", "a file named like an area"],
    ["webapp/src/index.ts", "a folder that only starts with an area name"],
    ["docs", "a file named docs"],
    ["documentation/guide.md", "a folder that only starts with docs"],
    ["LICENSE.txt", "a licence file with an extension"],
    ["license", "a lower case licence file"],
    ["LICENSE/notes.txt", "a folder named LICENSE"],
    ["README.MD", "Markdown with an upper case extension"],
    ["README.mdx", "an extension that only starts with md"],
    ["README.md.bak", "Markdown with a further extension"],
    ["notes/README.md", "Markdown in an unknown folder"],
    [".github/README.md", "Markdown in the workflow folder"],
    ["Web/src/index.ts", "an area name in another case"],
    ["./web/src/index.ts", "a path that does not start at the root"],
    ["/web/src/index.ts", "an absolute path"],
    [" web/src/index.ts", "a path with a leading space"],
    ['"web/caf\\303\\251.ts"', "a path git quoted"],
  ])("treats %s as shared because it is %s", (path) => {
    expect(affectedAreas([path])).toEqual(EVERY_AREA);
  });

  it("touches nothing when nothing changed", () => {
    expect(affectedAreas([])).toEqual(NO_AREA);
  });

  it("ignores blank lines", () => {
    expect(affectedAreas(["", "  ", "\t"])).toEqual(NO_AREA);
    expect(affectedAreas(["", "web/src/lib/money.ts", ""])).toEqual(
      only("web"),
    );
  });

  it("combines the areas of every changed path", () => {
    expect(
      affectedAreas([
        "backend/src/app.ts",
        "e2e/tests/cart/cart.spec.ts",
        "README.md",
      ]),
    ).toEqual(only("backend", "e2e", "docs"));
  });

  it("counts a path in the same area once", () => {
    expect(affectedAreas(["web/a.ts", "web/b.ts"])).toEqual(only("web"));
  });

  it("touches every area when any one path is shared", () => {
    expect(
      affectedAreas(["README.md", "pnpm-lock.yaml", "web/src/lib/money.ts"]),
    ).toEqual(EVERY_AREA);
    expect(affectedAreas(["docs/a.md", ".github/workflows/ci.yml"])).toEqual(
      EVERY_AREA,
    );
  });

  it("returns exactly one entry per area", () => {
    expect(Object.keys(affectedAreas(["web/a.ts"]))).toEqual([...AREAS]);
    expect(Object.keys(affectedAreas([]))).toEqual([...AREAS]);
    expect(Object.keys(affectedAreas(["package.json"]))).toEqual([...AREAS]);
  });
});

describe("everyArea", () => {
  it("touches every area", () => {
    expect(everyArea()).toEqual(EVERY_AREA);
    expect(Object.keys(everyArea())).toEqual([...AREAS]);
  });
});

describe("formatOutputs", () => {
  it("prints one area=value line per area in area order", () => {
    expect(formatOutputs(only("web", "docs"))).toBe(
      [
        "backend=false",
        "web=true",
        "legacy=false",
        "e2e=false",
        "scripts=false",
        "lighthouse=false",
        "docs=true",
      ].join("\n"),
    );
  });

  it("prints every area as true or every area as false", () => {
    expect(formatOutputs(EVERY_AREA).split("\n")).toEqual(
      AREAS.map((area) => `${area}=true`),
    );
    expect(formatOutputs(NO_AREA).split("\n")).toEqual(
      AREAS.map((area) => `${area}=false`),
    );
  });
});

describe("gitDiffArgs", () => {
  it("lists changed names without rename detection, so a moved file counts at both its old and new path", () => {
    expect(gitDiffArgs(BASE, HEAD)).toEqual([
      "diff",
      "--name-only",
      "--no-renames",
      BASE,
      HEAD,
    ]);
  });
});

describe("parseChangesArgs", () => {
  it("reads --all", () => {
    expect(parseChangesArgs(["--all"])).toEqual({ all: true });
  });

  it("reads --base and --head in either order", () => {
    expect(parseChangesArgs(["--base", BASE, "--head", HEAD])).toEqual({
      base: BASE,
      head: HEAD,
    });
    expect(parseChangesArgs(["--head", HEAD, "--base", BASE])).toEqual({
      base: BASE,
      head: HEAD,
    });
    expect(parseChangesArgs([`--base=${BASE}`, `--head=${HEAD}`])).toEqual({
      base: BASE,
      head: HEAD,
    });
  });

  it("accepts SHA-256 commit ids", () => {
    const base = "a".repeat(64);
    const head = "b".repeat(64);
    expect(parseChangesArgs(["--base", base, "--head", head])).toEqual({
      base,
      head,
    });
  });

  it("refuses no arguments", () => {
    expect(() => parseChangesArgs([])).toThrow(
      `Pass --all, or --base and --head.\n${USAGE}`,
    );
  });

  it("refuses --all together with a commit", () => {
    const message = `Pass either --all or --base and --head, not both.\n${USAGE}`;
    expect(() => parseChangesArgs(["--all", "--base", BASE])).toThrow(message);
    expect(() => parseChangesArgs(["--all", "--head", HEAD])).toThrow(message);
    expect(() =>
      parseChangesArgs(["--all", "--base", BASE, "--head", HEAD]),
    ).toThrow(message);
  });

  it("refuses --base without --head and --head without --base", () => {
    const message = `Pass --base and --head together.\n${USAGE}`;
    expect(() => parseChangesArgs(["--base", BASE])).toThrow(message);
    expect(() => parseChangesArgs(["--head", HEAD])).toThrow(message);
  });

  it.each([
    ["an empty value", ""],
    ["a branch name", "main"],
    ["a short SHA", BASE.slice(0, 7)],
    ["a SHA one character short", BASE.slice(0, 39)],
    ["a SHA one character long", `${BASE}0`],
    ["an upper case SHA", BASE.toUpperCase()],
    ["a SHA with a non hex character", `${BASE.slice(0, 39)}g`],
    ["a value that looks like an option", `--output=${BASE}`],
    ["a SHA with surrounding space", ` ${BASE} `],
    ["a revision range", `${BASE}..${HEAD}`],
  ])("refuses %s as a commit", (_label, value) => {
    expect(() => parseChangesArgs([`--base=${value}`, "--head", HEAD])).toThrow(
      `--base and --head must be full commit SHAs.\n${USAGE}`,
    );
    expect(() => parseChangesArgs(["--base", BASE, `--head=${value}`])).toThrow(
      `--base and --head must be full commit SHAs.\n${USAGE}`,
    );
  });

  it("refuses unknown options with the parser's reason", () => {
    expect(() => parseChangesArgs(["--everything"])).toThrow(
      /Unknown option '--everything'.*\nUsage: /s,
    );
  });

  it("refuses positional arguments", () => {
    expect(() => parseChangesArgs(["--all", "web"])).toThrow(
      /Unexpected argument 'web'.*\nUsage: /s,
    );
  });

  it("refuses a value for --all", () => {
    expect(() => parseChangesArgs(["--all=false"])).toThrow(
      /--all.*does not take an argument.*\nUsage: /s,
    );
  });

  it("refuses an option without its value", () => {
    expect(() => parseChangesArgs(["--head", HEAD, "--base"])).toThrow(
      /--base.*argument missing.*\nUsage: /s,
    );
  });

  it("explains how to call the command", () => {
    expect(USAGE).toBe(
      "Usage: node scripts/ci/cli.ts --all | --base <sha> --head <sha>",
    );
  });
});
