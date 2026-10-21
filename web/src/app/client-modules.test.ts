import { describe, expect, it, vi } from "vitest";

vi.mock("zod", () => {
  throw new Error("zod reached a client module");
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

const LIST_PAGE_CLIENT_MODULES: [string, () => Promise<unknown>][] = [
  ["status region", () => import("@/components/status-region")],
  ["catalog navigation", () => import("@/features/catalog/catalog-navigation")],
  ["family filter", () => import("@/features/catalog/family-filter")],
];

describe("client modules on the product list", () => {
  it.each(LIST_PAGE_CLIENT_MODULES)(
    "%s loads without zod, cn, lucide-react or radix-ui",
    async (_name, load) => {
      await expect(load()).resolves.toBeDefined();
    },
  );
});
