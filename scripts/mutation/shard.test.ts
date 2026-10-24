import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  mutateFiles,
  parseShard,
  planShard,
  shardFiles,
  type SizedFile,
} from "./shard.ts";

const scratch = (): string => mkdtempSync(join(tmpdir(), "mutation-shard-"));

const put = (root: string, path: string, bytes = 1): void => {
  const target = join(root, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, "x".repeat(bytes));
};

const file = (path: string, size: number): SizedFile => ({ path, size });

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

const allShards = (files: readonly SizedFile[], total: number): string[][] =>
  Array.from({ length: total }, (_, index) =>
    shardFiles(files, index + 1, total),
  );

const WEB_PATTERNS = [
  "src/features/**/*.ts",
  "src/lib/**/*.ts",
  "!src/**/*.test.ts",
  "!src/lib/backend/client.ts",
];

const webTree = (): string => {
  const root = scratch();
  put(root, "src/features/cart/totals.ts", 700);
  put(root, "src/features/cart/totals.test.ts", 900);
  put(root, "src/features/checkout/card.ts", 940);
  put(root, "src/features/top.ts", 50);
  put(root, "src/lib/money.ts", 420);
  put(root, "src/lib/backend/client.ts", 2000);
  put(root, "src/lib/backend/schemas.ts", 3400);
  put(root, "src/lib/view.tsx", 300);
  put(root, "src/app/page.ts", 500);
  put(root, "stryker.config.json", 10);
  return root;
};

describe("parseShard", () => {
  it("reads a one based index and a total", () => {
    expect(parseShard("2/3")).toEqual({ index: 2, total: 3 });
    expect(parseShard("1/1")).toEqual({ index: 1, total: 1 });
    expect(parseShard("3/3")).toEqual({ index: 3, total: 3 });
    expect(parseShard("10/12")).toEqual({ index: 10, total: 12 });
  });

  it.each([
    ["0/3", "an index of zero"],
    ["4/3", "an index above the total"],
    ["1/0", "a total of zero"],
    ["0/0", "an index and a total of zero"],
    ["a/3", "a letter for the index"],
    ["1/b", "a letter for the total"],
    ["1", "a missing total"],
    ["/3", "a missing index"],
    ["1/", "an empty total"],
    ["1/3/4", "three parts"],
    ["-1/3", "a negative index"],
    ["1/-3", "a negative total"],
    ["1.5/3", "a fractional index"],
    ["1/3.0", "a decimal total"],
    ["+1/3", "a signed index"],
    ["01/3", "a leading zero"],
    ["1e0/3", "an exponent"],
    ["0x1/3", "a hexadecimal index"],
    [" 1/3", "a leading space"],
    ["1/3 ", "a trailing space"],
    ["1 / 3", "spaces around the slash"],
    ["1\\3", "a backslash"],
    ["", "an empty spec"],
    ["1/99999999999999999999", "a total too large to count exactly"],
  ])("rejects %j because it has %s", (spec) => {
    expect(refusal(() => parseShard(spec))).toBe(
      `Invalid shard ${JSON.stringify(spec)}: use <index>/<total> with whole numbers and 1 <= index <= total.`,
    );
  });
});

describe("shardFiles", () => {
  it("places the largest files first, each on the lightest shard so far", () => {
    const files = [
      file("a.ts", 10),
      file("b.ts", 9),
      file("c.ts", 8),
      file("d.ts", 2),
      file("e.ts", 1),
    ];
    expect(shardFiles(files, 1, 2)).toEqual(["a.ts", "d.ts", "e.ts"]);
    expect(shardFiles(files, 2, 2)).toEqual(["b.ts", "c.ts"]);
  });

  it("gives a tie between shards to the lowest shard number", () => {
    const files = [file("a.ts", 5), file("b.ts", 5), file("c.ts", 1)];
    expect(shardFiles(files, 1, 2)).toEqual(["a.ts", "c.ts"]);
    expect(shardFiles(files, 2, 2)).toEqual(["b.ts"]);
  });

  it("orders files of the same size by path", () => {
    const files = [file("z.ts", 5), file("a.ts", 5), file("m.ts", 5)];
    expect(allShards(files, 2)).toEqual([["a.ts", "z.ts"], ["m.ts"]]);
    expect(allShards(files, 3)).toEqual([["a.ts"], ["m.ts"], ["z.ts"]]);
  });

  it("orders paths by code unit, not by locale", () => {
    const files = [file("b.ts", 1), file("B.ts", 1), file("a.ts", 1)];
    expect(allShards(files, 3)).toEqual([["B.ts"], ["a.ts"], ["b.ts"]]);
  });

  it("returns the paths of a shard sorted by path", () => {
    const files = [file("z.ts", 10), file("m.ts", 4), file("a.ts", 3)];
    expect(shardFiles(files, 1, 2)).toEqual(["z.ts"]);
    expect(shardFiles(files, 2, 2)).toEqual(["a.ts", "m.ts"]);
    expect(shardFiles(files, 1, 1)).toEqual(["a.ts", "m.ts", "z.ts"]);
  });

  it("does not depend on the order of the input", () => {
    const files = [
      file("src/a.ts", 3420),
      file("src/b.ts", 1375),
      file("src/c.ts", 3004),
      file("src/d.ts", 604),
      file("src/e.ts", 3004),
      file("src/f.ts", 202),
    ];
    const reversed = files.toReversed();
    expect(allShards(reversed, 3)).toEqual(allShards(files, 3));
    expect(allShards(files, 3)).toEqual([
      ["src/a.ts", "src/f.ts"],
      ["src/b.ts", "src/c.ts"],
      ["src/d.ts", "src/e.ts"],
    ]);
  });

  it("keeps shards disjoint and covers every file", () => {
    const files = Array.from({ length: 22 }, (_, index) =>
      file(`src/file-${String(index).padStart(2, "0")}.ts`, (index * 37) % 11),
    );
    const shards = allShards(files, 3);
    const placed = shards.flat();
    expect(placed.toSorted()).toEqual(files.map(({ path }) => path).toSorted());
    expect(new Set(placed).size).toBe(files.length);
    expect(shards.every((shard) => shard.length > 0)).toBe(true);
  });

  it("balances the total size of each shard", () => {
    const files = [
      file("a.ts", 6),
      file("b.ts", 5),
      file("c.ts", 4),
      file("d.ts", 3),
      file("e.ts", 2),
      file("f.ts", 1),
    ];
    const size = (paths: string[]): number =>
      paths
        .map((path) => files.find((entry) => entry.path === path)?.size ?? 0)
        .reduce((sum, value) => sum + value, 0);
    expect(allShards(files, 3).map(size)).toEqual([7, 7, 7]);
  });

  it("leaves extra shards empty when there are more shards than files", () => {
    const files = [file("b.ts", 1), file("a.ts", 2)];
    expect(allShards(files, 4)).toEqual([["a.ts"], ["b.ts"], [], []]);
  });

  it("returns an empty shard for no files", () => {
    expect(allShards([], 3)).toEqual([[], [], []]);
  });

  it("puts every file on the only shard", () => {
    expect(shardFiles([file("b.ts", 1), file("a.ts", 9)], 1, 1)).toEqual([
      "a.ts",
      "b.ts",
    ]);
  });

  it("puts empty files on the lightest shard, which they leave the lightest", () => {
    expect(
      allShards([file("a.ts", 0), file("b.ts", 0), file("c.ts", 0)], 2),
    ).toEqual([["a.ts", "b.ts", "c.ts"], []]);
    expect(
      allShards([file("a.ts", 0), file("b.ts", 0), file("c.ts", 4)], 2),
    ).toEqual([["c.ts"], ["a.ts", "b.ts"]]);
  });

  it.each([
    [0, 3],
    [4, 3],
    [1, 0],
    [-1, 3],
    [1.5, 3],
    [1, 2.5],
    [Number.NaN, 3],
    [1, Number.POSITIVE_INFINITY],
  ])("rejects shard %d of %d", (index, total) => {
    expect(refusal(() => shardFiles([file("a.ts", 1)], index, total))).toBe(
      `Invalid shard ${String(index)}/${String(total)}: use <index>/<total> with whole numbers and 1 <= index <= total.`,
    );
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects a file size of %d",
    (size) => {
      expect(refusal(() => shardFiles([file("a.ts", size)], 1, 1))).toBe(
        `Invalid size ${String(size)} for a.ts.`,
      );
    },
  );

  it("rejects the same path twice", () => {
    expect(
      refusal(() =>
        shardFiles([file("a.ts", 1), file("b.ts", 1), file("a.ts", 2)], 1, 2),
      ),
    ).toBe("a.ts is listed more than once.");
  });
});

describe("mutateFiles", () => {
  it("expands the patterns relative to the folder, without excluded files", () => {
    expect(mutateFiles(WEB_PATTERNS, webTree())).toEqual([
      "src/features/cart/totals.ts",
      "src/features/checkout/card.ts",
      "src/features/top.ts",
      "src/lib/backend/schemas.ts",
      "src/lib/money.ts",
    ]);
  });

  it("applies the patterns in order, so a later pattern can add back what an earlier one removed", () => {
    const root = webTree();
    expect(mutateFiles(["!src/lib/money.ts", "src/lib/*.ts"], root)).toEqual([
      "src/lib/money.ts",
    ]);
    expect(
      mutateFiles(
        ["src/lib/**/*.ts", "!src/lib/backend/**", "src/lib/backend/client.ts"],
        root,
      ),
    ).toEqual(["src/lib/backend/client.ts", "src/lib/money.ts"]);
  });

  it("lists a file matched by several patterns once", () => {
    expect(
      mutateFiles(
        ["src/lib/*.ts", "src/lib/money.ts", "src/**/money.ts"],
        webTree(),
      ),
    ).toEqual(["src/lib/money.ts"]);
  });

  it("returns nothing for no patterns or for patterns that match nothing", () => {
    const root = webTree();
    expect(mutateFiles([], root)).toEqual([]);
    expect(mutateFiles(["src/missing/**/*.ts"], root)).toEqual([]);
    expect(mutateFiles(["!src/**/*.ts"], root)).toEqual([]);
  });

  it("skips folders whose names match a pattern", () => {
    const root = scratch();
    put(root, "src/lib/a.ts");
    put(root, "src/lib/folder.ts/inside.txt");
    expect(mutateFiles(["src/lib/*.ts"], root)).toEqual(["src/lib/a.ts"]);
  });

  it("skips hidden files and folders, as Stryker does", () => {
    const root = scratch();
    put(root, "src/lib/a.ts");
    put(root, "src/lib/.b.ts");
    put(root, "src/lib/.cache/c.ts");
    expect(mutateFiles(["src/lib/**/*.ts"], root)).toEqual(["src/lib/a.ts"]);
  });

  it("sorts the paths by code unit", () => {
    const root = scratch();
    put(root, "src/b.ts");
    put(root, "src/Z.ts");
    put(root, "src/a/z.ts");
    put(root, "src/a.ts");
    expect(mutateFiles(["src/**/*.ts"], root)).toEqual([
      "src/Z.ts",
      "src/a.ts",
      "src/a/z.ts",
      "src/b.ts",
    ]);
  });
});

describe("planShard", () => {
  const config = { mutate: WEB_PATTERNS };

  it("shards the files the config mutates by their size on disk", () => {
    const root = webTree();
    expect(planShard(config, root, "1/3")).toEqual([
      "src/lib/backend/schemas.ts",
    ]);
    expect(planShard(config, root, "2/3")).toEqual([
      "src/features/checkout/card.ts",
      "src/features/top.ts",
    ]);
    expect(planShard(config, root, "3/3")).toEqual([
      "src/features/cart/totals.ts",
      "src/lib/money.ts",
    ]);
  });

  it("covers every mutated file exactly once across the shards", () => {
    const root = webTree();
    const shards = ["1/2", "2/2"].map((spec) => planShard(config, root, spec));
    expect(shards.flat().toSorted()).toEqual(mutateFiles(WEB_PATTERNS, root));
    expect(shards.flat()).toHaveLength(5);
  });

  it("refuses an invalid shard", () => {
    expect(refusal(() => planShard(config, webTree(), "4/3"))).toContain(
      'Invalid shard "4/3"',
    );
  });

  it.each([
    ["no config", undefined],
    ["a null config", null],
    ["a config that is not an object", "src/**/*.ts"],
    ["a config that is a list", ["src/**/*.ts"]],
    ["a config without mutate", { testRunner: "command" }],
    ["mutate that is not a list", { mutate: "src/**/*.ts" }],
    ["an empty mutate list", { mutate: [] }],
    ["mutate with a pattern that is not text", { mutate: ["src/**/*.ts", 1] }],
  ])("refuses %s", (_label, value) => {
    expect(refusal(() => planShard(value, webTree(), "1/3"))).toBe(
      "The Stryker config has no mutate list of glob patterns.",
    );
  });

  it("refuses a config whose patterns match no files, so a broken config cannot skip mutation", () => {
    expect(
      refusal(() =>
        planShard({ mutate: ["src/missing/**/*.ts"] }, webTree(), "1/3"),
      ),
    ).toBe("The mutate patterns match no files.");
  });

  it.each([
    "src/lib/money.ts:1-3",
    "src/lib/money.ts:1:2-3:4",
    "src/lib/money.ts:5-6:4",
    "src/lib/money.ts:10:12-30:40",
    "!src/lib/money.ts:10-12",
  ])("refuses the mutation range in %s, which cannot be sharded", (pattern) => {
    expect(
      refusal(() =>
        planShard({ mutate: ["src/lib/*.ts", pattern] }, webTree(), "1/3"),
      ),
    ).toBe(`Mutation ranges cannot be sharded: ${pattern}`);
  });

  it.each([",", "*", "?", "[", "]", "{", "}", "(", ")", "!", "#", ":", "\\"])(
    "refuses a file name with %s, which Stryker would read as a pattern",
    (character) => {
      const root = webTree();
      const path = `src/lib/odd${character}name.ts`;
      put(root, path);
      expect(refusal(() => planShard(config, root, "1/3"))).toBe(
        `Cannot pass ${path} to Stryker --mutate as a plain path.`,
      );
    },
  );

  it("does not mistake a folder name with a colon in the middle of a pattern for a mutation range", () => {
    expect(
      planShard(
        { mutate: ["src/lib/*.ts", "src/v:1-2/*.ts"] },
        webTree(),
        "1/1",
      ),
    ).toEqual(["src/lib/money.ts"]);
  });

  it("accepts file names with dots, dashes, underscores and digits", () => {
    const root = scratch();
    put(root, "src/lib/a-b_c.2.d.ts");
    expect(planShard({ mutate: ["src/**/*.ts"] }, root, "1/1")).toEqual([
      "src/lib/a-b_c.2.d.ts",
    ]);
  });
});
