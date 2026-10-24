import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findClientModules,
  unclassifiedClientModules,
} from "./client-module-scan";

vi.mock("zod", () => {
  throw new Error("zod reached a client module");
});

vi.mock("zod/mini", () => {
  throw new Error("zod/mini reached a client module");
});

vi.mock("zod/v4", () => {
  throw new Error("zod/v4 reached a client module");
});

vi.mock("tailwind-merge", () => {
  throw new Error("tailwind-merge reached a client module");
});

vi.mock("@radix-ui/react-slot", () => {
  throw new Error("@radix-ui/react-slot reached a client module");
});

vi.mock("@radix-ui/react-label", () => {
  throw new Error("@radix-ui/react-label reached a client module");
});

vi.mock("@radix-ui/react-checkbox", () => {
  throw new Error("@radix-ui/react-checkbox reached a client module");
});

vi.mock("cn", () => {
  throw new Error("cn reached a client module");
});

vi.mock("lucide-react", () => {
  throw new Error("lucide-react reached a client module");
});

vi.mock("radix-ui", () => {
  throw new Error("radix-ui reached a client module");
});

const LIST_PAGE_FILES = [
  "app/error.tsx",
  "components/status-region.tsx",
  "features/cart/add-to-cart-form.tsx",
  "features/catalog/catalog-navigation.tsx",
  "features/catalog/family-filter.tsx",
  "features/catalog/sort-select-control.tsx",
];

const OFF_PAGE_FILES = [
  "components/ui/checkbox.tsx",
  "components/ui/label.tsx",
  "components/ui/table.tsx",
  "features/cart/cart-quantity-input.tsx",
  "features/cart/quantity-add-form.tsx",
  "features/checkout/checkout-form.tsx",
];

const SOURCE_ROOT = path.resolve(import.meta.dirname, "..");

const LIST_PAGE_CLIENT_MODULES: [string, () => Promise<unknown>][] = [
  ["status region", () => import("@/components/status-region")],
  ["catalog navigation", () => import("@/features/catalog/catalog-navigation")],
  ["family filter", () => import("@/features/catalog/family-filter")],
  [
    "sort select control",
    () => import("@/features/catalog/sort-select-control"),
  ],
  ["add to cart form", () => import("@/features/cart/add-to-cart-form")],
  ["error page", () => import("./error")],
];

describe("client modules on the product list", () => {
  it.each(LIST_PAGE_CLIENT_MODULES)(
    "%s loads without zod, cn, lucide-react or radix-ui",
    async (_name, load) => {
      await expect(load()).resolves.toBeDefined();
    },
  );
});

describe("client module classification", () => {
  it("finds no client module outside the list page and off page sets", () => {
    expect(
      unclassifiedClientModules(findClientModules(SOURCE_ROOT), [
        ...LIST_PAGE_FILES,
        ...OFF_PAGE_FILES,
      ]),
    ).toEqual([]);
  });

  it("lists exactly the classified files as client modules", () => {
    expect(findClientModules(SOURCE_ROOT)).toEqual(
      [...LIST_PAGE_FILES, ...OFF_PAGE_FILES].sort(),
    );
  });

  it("keeps the list page set and the off page set apart", () => {
    expect(
      LIST_PAGE_FILES.filter((file) => OFF_PAGE_FILES.includes(file)),
    ).toEqual([]);
  });

  it("covers every list page file with a load check", () => {
    expect(LIST_PAGE_CLIENT_MODULES).toHaveLength(LIST_PAGE_FILES.length);
  });
});

describe("client module scan", () => {
  const roots: string[] = [];

  function tree(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), "client-scan-"));
    roots.push(root);
    for (const [file, content] of Object.entries(files)) {
      const target = path.join(root, file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    return root;
  }

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("finds a file that opens with the directive in either quote style", () => {
    const root = tree({
      "a.tsx": '"use client";\nexport const a = 1;\n',
      "b.ts": "'use client'\nexport const b = 1;\n",
    });
    expect(findClientModules(root)).toEqual(["a.tsx", "b.ts"]);
  });

  it("finds a directive that follows leading blank lines", () => {
    const root = tree({ "a.tsx": '\n\n  "use client";\nexport {};\n' });
    expect(findClientModules(root)).toEqual(["a.tsx"]);
  });

  it("ignores a directive that is not the first statement", () => {
    const root = tree({
      "a.ts": 'export const note = "use client";\n',
      "b.ts": 'import x from "x";\n"use client";\n',
    });
    expect(findClientModules(root)).toEqual([]);
  });

  it("ignores files that are not ts or tsx", () => {
    const root = tree({
      "a.js": '"use client";\n',
      "b.md": '"use client"\n',
    });
    expect(findClientModules(root)).toEqual([]);
  });

  it("scans nested folders and reports forward slash paths in order", () => {
    const root = tree({
      "z/deep/one.tsx": '"use client";\n',
      "a/two.tsx": '"use client";\n',
    });
    expect(findClientModules(root)).toEqual(["a/two.tsx", "z/deep/one.tsx"]);
  });

  it("skips the debug and probe folders", () => {
    const root = tree({
      "zz-debug/x.tsx": '"use client";\n',
      "zz-probe/y.tsx": '"use client";\n',
      "keep/z.tsx": '"use client";\n',
    });
    expect(findClientModules(root)).toEqual(["keep/z.tsx"]);
  });

  it("returns nothing for an empty tree", () => {
    expect(findClientModules(tree({}))).toEqual([]);
  });

  it("names every client module missing from the classification", () => {
    expect(
      unclassifiedClientModules(["a.tsx", "b.tsx", "c.tsx"], ["b.tsx"]),
    ).toEqual(["a.tsx", "c.tsx"]);
  });

  it("names nothing when every client module is classified", () => {
    expect(unclassifiedClientModules(["a.tsx"], ["a.tsx", "x.tsx"])).toEqual(
      [],
    );
  });
});
